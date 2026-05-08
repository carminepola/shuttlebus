import { Request, Response, NextFunction } from "express";

import MessageModel from "../model/messageModel";

// Tipo per i permessi e ruoli richiesti (possono essere array o singoli valori)
type RequiredRole = number;
type RequiredPermission = string | string[];
// Middleware di Autenticazione e Autorizzazione
/**
 * Verifica se l'utente ha i permessi e ruoli richiesti per accedere
 * alla risorsa.
 * @param requiredRoles Ruoli richiesti
 * @param requiredPermissions Permessi richiesti
 * @returns Il middleware
 */
const checkPermissionMiddleware = (requiredRoles: RequiredRole, requiredPermissions: RequiredPermission) => {
  return (req: Request, res: Response<MessageModel>, next: NextFunction) => {
    if (res.locals.userLogged) {
      let user = res.locals.userLogged;
      const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

      const hasRequiredRole = user.role <= requiredRoles;
      const hasRequiredPermission = permissions.some((permission) => user.permissions.includes(permission));

      if (hasRequiredRole || hasRequiredPermission) {
        next();
      } else {
        res.locals.customErrorMessage = "Permessi insufficienti";
        return res.sendStatus(403);
      }
    } else {
      return res.sendStatus(401);
    }
  };
};

export default checkPermissionMiddleware;
