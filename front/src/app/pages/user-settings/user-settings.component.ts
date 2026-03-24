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
import { UserService } from '../../services/user/user.service';
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
  userDetailsForm: FormGroup;
  loading = false;
  loadingDetails = false;
  successMessage = '';
  errorMessage = '';
  successMessageDetails = '';
  errorMessageDetails = '';

  constructor(
    private authService: AuthService,
    private userService: UserService,
  ) {
    this.changePasswordForm = new FormGroup({
      oldPassword: new FormControl('', Validators.required),
      newPassword: new FormControl('', [
        Validators.required,
        Validators.minLength(6),
      ]),
      repeatPassword: new FormControl('', Validators.required),
    });

    this.userDetailsForm = new FormGroup({
      name: new FormControl('', Validators.required),
      phone: new FormControl(''),
    });
  }

  navBar = false;
  ngOnInit(): void {
    this.navBar = !window.location.pathname.includes('admin');
    this.loadCurrentUser();
  }

  loadCurrentUser(): void {
    this.userService.getCurrentUser().subscribe({
      next: (user) => {
        this.userDetailsForm.patchValue({
          name: user.details?.name || '',
          phone: user.details?.phone || '',
        });
      },
      error: (error) => {
        console.error('Error loading user details:', error);
      },
    });
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

    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';

    const decodedToken = this.authService.getDecodedToken();
    const email = decodedToken?.email;

    if (!email) {
      this.errorMessage = "Impossibile recuperare l'email dell'utente";
      this.loading = false;
      return;
    }

    this.userService.changePassword(email, oldPassword, newPassword).subscribe(
      (res) => {
        this.loading = false;
        this.successMessage = 'Password cambiata con successo!';
        this.changePasswordForm.reset();
        setTimeout(() => {
          this.successMessage = '';
        }, 3000);
      },
      (err) => {
        this.loading = false;
        console.error('Error changing password:', err);
        if (err.error?.message) {
          this.errorMessage = err.error.message;
        } else if (err.status === 400) {
          this.errorMessage = 'La vecchia password non è corretta';
        } else {
          this.errorMessage =
            'Si è verificato un errore durante il cambio password';
        }
      },
    );
  }

  onSubmitDetails(): void {
    if (this.userDetailsForm.invalid) {
      return;
    }

    this.loadingDetails = true;
    this.successMessageDetails = '';
    this.errorMessageDetails = '';

    const name = this.userDetailsForm.get('name')?.value;
    const phone = this.userDetailsForm.get('phone')?.value;

    this.userService.updateUserDetails(name, phone).subscribe(
      (res) => {
        this.loadingDetails = false;
        this.successMessageDetails = 'Dettagli aggiornati con successo!';
        setTimeout(() => {
          this.successMessageDetails = '';
        }, 3000);
      },
      (err) => {
        this.loadingDetails = false;
        console.error('Error updating user details:', err);
        if (err.error?.message) {
          this.errorMessageDetails = err.error.message;
        } else {
          this.errorMessageDetails =
            "Si è verificato un errore durante l'aggiornamento dei dettagli";
        }
      },
    );
  }
}
