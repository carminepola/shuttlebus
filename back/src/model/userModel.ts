import permissionModel from "./permissionModel";
import sessionModel from "./sessionModel";
import { role } from "../enum/role";

export default class userModel {
  email: string;
  details: {
    name?: string;
    surname?: string;
    phone?: string;
    address?: string;
    city?: string;
    zipCode?: string;
  };
  password: string;
  sessions: sessionModel[];
  role: number;
  permissions: permissionModel[];
  disabled: boolean;
  createdAt: number;
  updatedAt: number;
  constructor() {
    this.email = "";
    this.details = {};
    this.password = "";
    this.sessions = [];
    this.role = role.NO_PERMISSION;
    this.permissions = [];
    this.disabled = true;
    this.createdAt = new Date().getTime();
    this.updatedAt = new Date().getTime();
  }
}
