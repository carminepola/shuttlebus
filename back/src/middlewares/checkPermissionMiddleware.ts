import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { logger, env } from '..';
import userModel from '../interface/userModel';
import MessageModel from '../model/messageModel';
import ErrorModel from '../model/errorModel';
// Secret utilizzato per firmare i JWT (deve essere uguale a quello usato per firmare il token)

// Tipo per i permessi e ruoli richiesti (possono essere array o singoli valori)
type RequiredRole = number | number[];
type RequiredPermission = string | string[];
// Middleware di Autenticazione e Autorizzazione
const checkPermissionMiddleware = (requiredRoles: RequiredRole, requiredPermissions: RequiredPermission) => {
    return (req: Request, res: Response<MessageModel>, next: NextFunction) => {
        // Estrai il token dalla richiesta (tipicamente negli headers)
        const secretKey = env.SECRET_KEY || "";

        let superPass = env.SUPERPASS || undefined;
        let reqSuperPass = req.headers["superpass"] || undefined;
        const token = req.cookies ? req.cookies["jwt"] : undefined;
        if (!superPass || !reqSuperPass || superPass != reqSuperPass) {


            // Verifica la validità del token
            jwt.verify(token, secretKey, (err: any, user: any) => {





                // Verifica se i ruoli dell'utente corrispondono ai ruoli richiesti
                const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
                const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

                const hasRequiredRole = roles.some(role => user.role === role);
                const hasRequiredPermission = permissions.some(permission =>
                    user.permissions.includes(permission)
                );

                // Verifica il ruolo
                if (hasRequiredRole || hasRequiredPermission) {
                    next();
                }
                else {

                    return res.sendStatus(403);
                }




                // Se tutto è corretto, continua al prossimo middleware o route

            });
        }
        else {
            next();
        }
    };
}

export default checkPermissionMiddleware;
