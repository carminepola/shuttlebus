import { Component, OnInit } from '@angular/core';

import { UserService } from '../../services/user/user.service';

@Component({
  selector: 'app-theme-toggle',
  imports: [],
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.scss',
})
export class ThemeToggleComponent implements OnInit {
  isDarkMode: boolean = false;
  isAutoMode: boolean = true;
  ngOnInit() {}
  constructor(private userService: UserService) {}
  toggleDarkMode(mode: string) {
    if (mode != 'auto') {
      localStorage['theme'] = mode;
    } else {
      localStorage['theme'] = mode;
    }

    this.check();
    this.userService.updateOptions({ theme: mode }).subscribe({
      next: (response: any) => {},
      error: (e: any) => {
        console.error(e);
      },
    });
  }
  check() {
    const theme = localStorage['theme'];

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
