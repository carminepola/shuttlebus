import { NextFunction, Request, Response } from "express";

import { logger } from "..";
import { validationResult } from "express-validator";
import ErrorModel from "../model/errorModel";
export default function validateDataMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      let error = new ErrorModel(

        400, undefined,
        undefined,
        errors.array()
      );

      Object.assign(res.locals.response, error);

      return res.status(400).json({});
    }
    next();
  } catch (error) {
    logger.error(
      "Errore in tokenRequestMiddleware: " + JSON.stringify(error),
      res.locals.log
    );
    next(error);
  }
}
