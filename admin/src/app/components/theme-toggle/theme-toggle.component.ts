import { Component, OnInit } from '@angular/core';

import { UserService } from '../../services/user/user.service';
import { AuthService } from '../../services/auth/auth.service';
@Component({
  selector: 'app-theme-toggle',
  imports: [],
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss',
})
export class ThemeToggleComponent implements OnInit {
  isDarkMode: boolean = false;
  isAutoMode: boolean = true;
  ngOnInit() {
    this.check();
  }
  constructor(
    private userService: UserService,
    private authService: AuthService
  ) {}
  toggleDarkMode(mode: string) {
    if (mode != 'auto') {
      localStorage['theme'] = mode;
    } else {
      localStorage['theme'] = mode;
    }

    switch (mode) {
      case 'auto':
        this.isAutoMode = true;

        break;
      case 'dark':
        this.isAutoMode = false;
        this.isDarkMode = true;
        break;
      case 'light':
        this.isAutoMode = false;
        this.isDarkMode = false;
        break;
      default:
        this.isAutoMode = true;
        break;
    }

    this.userService.updateOptions({ theme: mode }).subscribe({
      next: (response: any) => {},
      error: (e: any) => {
        console.error(e);
      },
    });
  }
  check() {
    let user = this.authService.getDecodedToken();

    debugger;
    const theme = user?.options?.theme ? user?.options?.theme : 'auto';

    switch (theme) {
      case 'auto':
        this.isAutoMode = true;

        break;
      case 'dark':
        this.isAutoMode = false;
        this.isDarkMode = true;
        break;
      case 'light':
        this.isAutoMode = false;
        this.isDarkMode = false;
        break;
      default:
        this.isAutoMode = true;
        break;
    }
  }
}
