import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { fadeAnimation } from '../../animations/fade.animation';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import { ThemeToggleComponent } from '../../components/theme-toggle/theme-toggle.component';
import { AuthService } from '../../services/auth/auth.service';
import { TranslatePipe } from '../../pipe/translate.pipe';
@Component({
  selector: 'app-user-settings',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TitlePageComponent,
    TranslatePipe,
  ],
  templateUrl: './user-settings.component.html',
  styleUrls: ['./user-settings.component.scss'],
  animations: [fadeAnimation],
  standalone: true,
})
export class UserSettingsComponent implements OnInit {
  changePasswordForm: FormGroup;

  constructor(private authService: AuthService) {
    this.changePasswordForm = new FormGroup({
      oldPassword: new FormControl('', Validators.required),
      newPassword: new FormControl('', [
        Validators.required,
        Validators.minLength(6),
      ]),
      repeatPassword: new FormControl('', Validators.required),
    });
  }

  navBar = false;
  ngOnInit(): void {
    this.navBar = !window.location.pathname.includes('admin');
  }

  onSubmit(): void {
    if (this.changePasswordForm.invalid) {
      return;
    }

    const oldPassword = this.changePasswordForm.get('oldPassword')?.value;
    const newPassword = this.changePasswordForm.get('newPassword')?.value;
    const repeatPassword = this.changePasswordForm.get('repeatPassword')?.value;

    if (newPassword !== repeatPassword) {
      this.changePasswordForm
        .get('repeatPassword')
        ?.setErrors({ mustMatch: true });
      return;
    }

    // this.authService.changePassword(oldPassword, newPassword).subscribe(
    //   (res) => {
    //     console.log(res);
    //   },
    //   (err) => {
    //     console.log(err);
    //   }
    // );
  }
}
