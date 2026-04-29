import permissionModel from './permissionModel';
import sessionModel from './sessionModel';
import { role } from '../enum/role';

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

  options: { [key: string]: any };

  password?: string;

  sessions: sessionModel[];

  role: number;

  privacyAndPolicy: boolean;

  privacyAndPolicyConfirmDate: number;

  permissions?: permissionModel[];

  disabled?: boolean;

  createdAt: number;

  updatedAt: number;

  constructor(user: any = {}) {
    this.email = user.email || '';
    this.privacyAndPolicy = user.privacyAndPolicy || false;
    this.privacyAndPolicyConfirmDate = user.privacyAndPolicyConfirmDate || '';
    this.details = user.details || {};
    if (user.password) {
      this.password = user.password || '';
    }
    this.sessions = user.sessions || [];
    this.permissions = user.permissions || [];
    this.disabled = user.disabled || false;

    this.role = user.role || role.NO_PERMISSION;
    this.options = user.options || {};

    this.createdAt = user.createdAt || new Date().getTime();

    this.updatedAt = new Date().getTime();
  }
}
