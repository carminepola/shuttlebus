import express from "express";
import { db } from "../index";
import { Request, Response, NextFunction } from "express";
import permissionDao from "../dao/permission/permissionDao";
import { check } from "express-validator";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
import { role } from "../enum/role";
import authMiddleware from "../middlewares/authMiddleware";

const router = express.Router();

router.get("/",
    authMiddleware,
    checkPermissionMiddleware(role.ADMIN, ["PERMISSION_MANAGEMENT"]), async (req, res, next) => {
        try {
            let permissionDaoInstance = new permissionDao(db);
            const result = await permissionDaoInstance.readAll();
            res.json(result);
        } catch (error) {
            next(error);
        }
    });

router.post(
    "/",
    [
        check("id").notEmpty().withMessage("id is required"),
        check("description").notEmpty().withMessage("description is required"),
    ],
    validateDataMiddleware,
    authMiddleware,
    checkPermissionMiddleware(role.ADMIN, ["PERMISSION_MANAGEMENT"]),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            let permissionDaoInstance = new permissionDao(db);
            let permission: any = req.body;
            permission.id = permission.id.toUpperCase();
            const result = await permissionDaoInstance.insert(permission);
            res.locals.response.object = result;
            res.json(result);
        } catch (error) {
            next(error);
        }
    }
);

router.delete("/:id", authMiddleware, checkPermissionMiddleware(role.ADMIN, ["PERMISSION_MANAGEMENT"]), async (req: Request, res: Response, next: NextFunction) => {
    try {
        let permissionDaoInstance = new permissionDao(db);
        let id = req.params.id.toUpperCase();
        const result = await permissionDaoInstance.delete(id);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;

