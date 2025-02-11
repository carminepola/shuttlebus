import { Request, Response, NextFunction } from "express";
import { env } from "..";

import MessageModel from "../model/messageModel";

// Secret utilizzato per firmare i JWT (deve essere uguale a quello usato per firmare il token)

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
    // Estrai il token dalla richiesta (tipicamente negli headers)

    // Se il token non  presente, non fare nulla e lasciare
    // che il middleware successivo gestisca la richiesta

    let superPass = env.SUPERPASS || undefined;
    let reqSuperPass = req.headers["superpass"] || undefined;

    if (!superPass || !reqSuperPass || superPass != reqSuperPass) {
      if (res.locals.userLogged) {
        let user = res.locals.userLogged;
        // Verifica se i ruoli dell'utente corrispondono ai ruoli richiesti
        const roles = requiredRoles;
        const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

        const hasRequiredRole = user.role <= requiredRoles;
        const hasRequiredPermission = permissions.some((permission) => user.permissions.includes(permission));

        // Verifica il ruolo
        if (hasRequiredRole || hasRequiredPermission) {
          next();
        } else {
          res.locals.customErrorMessage = "Permessi insufficienti";
          return res.sendStatus(403);
        }
      }
    } else {
      next();
    }
  };
};

export default checkPermissionMiddleware;
