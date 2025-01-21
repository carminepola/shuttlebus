import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { fadeAnimation } from '../../animations/fade.animation';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { AuthService } from '../../services/auth/auth.service';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { UserService } from '../../services/user/user.service';

@Component({
  selector: 'app-user-settings',
  imports: [CommonModule, ReactiveFormsModule, TitlePageComponent],
  templateUrl: './user-settings.component.html',
  styleUrl: './user-settings.component.scss',
  animations: [fadeAnimation],
  standalone: true
})
export class UserSettingsComponent implements OnInit {
  isDarkMode: boolean = false;
  isAutoMode: boolean = true;
  toggleDarkMode(mode: string) {

    this.userService.updateOptions({ theme: mode }).subscribe({
      next: (response: any) => {

        this.check();
        console.log(response)
      },
      error: (e: any) => {
        console.error(e);
      },
    });
  }
  constructor(private authService: AuthService, private userService: UserService) { }
  ngOnInit() {
    this.check();

  }
  check() {
    let user = this.authService.getDecodedToken();
    const theme = user?.options?.theme ? user.options.theme : 'auto';

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
