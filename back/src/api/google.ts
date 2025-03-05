const express = require("express");
const passport = require("passport");
const router = express.Router();
import { role } from "../enum/role";
import userModel from "../model/userModel";

import { Request, Response, NextFunction } from "express";
// Reindirizza l'utente a Google per il login
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Callback dopo il login su Google
router.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/login" }), (req: any, res: Response) => {
  if (!req.user) return res.redirect("/login");

  const user = new userModel();
  user.email = req.user.emails[0].value;
  user.details.name = req.user.name.givenName;
  user.options.google = req.user;
  user.role = role.USER;
  user.disabled = false;
  user.createdAt = new Date().getTime();
  user.updatedAt = new Date().getTime();

  // L'utente è autenticato, puoi creare un token JWT e inviarlo al frontend

  res.redirect(`http://localhost:4200}`);
});

module.exports = router;
