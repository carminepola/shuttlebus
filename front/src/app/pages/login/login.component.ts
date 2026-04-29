import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { PasskeyService } from '../../services/passkey/passkey.service';
import CryptoJS from 'crypto-js';
import { GoogleAuthService } from '../../services/google-auth/google-auth.service';
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  providers: [],
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  isSubmitted = false;
  loginError = '';
  isLoading = false;
  showPassword = false;
  passkeySupported = false;
  passkeyLoading = false;
  showPasskeyLogin = false;
  loginWithPasskeyForm!: FormGroup;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private googleAuthService: GoogleAuthService,
    private passkeyService: PasskeyService,
  ) {}

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/admin/home']);
    }
    this.passkeySupported = this.passkeyService.isSupported();
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false],
    });
    this.loginWithPasskeyForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      rememberMe: [false],
    });
  }

  get formControls() {
    return this.loginForm.controls;
  }
  loginWithGoogle() {
    localStorage.setItem('authUrl', '/admin/home');
    this.googleAuthService.loginWithGoogle();
  }
  onSubmit(event: Event): void {
    try {
      event.preventDefault();
      event.stopPropagation();

      this.isSubmitted = true;

      if (this.loginForm.invalid) {
        return;
      }

      this.isLoading = true;

      const { email, password, rememberMe } = this.loginForm.value;
      const md5Password = CryptoJS.MD5(password).toString();

      this.authService.login(email, md5Password, rememberMe).subscribe({
        next: (response: any) => {
          this.isLoading = false;
          this.router
            .navigate(['/admin/home'])
            .then(() => {
              // Navigazione completata
            })
            .catch((err) => {
              this.loginError = 'Errore durante la navigazione. Riprova.';
            });
          this.loginError = '';
        },
        error: (e: any) => {
          this.isLoading = false;
          console.error(e);
          //'Credenziali non valide. Riprova.'
          this.loginError = 'Credenziali non valide. Riprova.';
        },
      });
    } catch (e: any) {
      this.isLoading = false;
      console.error(e);
      this.loginError = 'Errore durante la navigazione. Riprova.';
    }
  }

  togglePasskeyLogin(): void {
    this.showPasskeyLogin = !this.showPasskeyLogin;
    this.loginError = '';
  }

  async loginWithPasskey(): Promise<void> {
    const email = this.loginWithPasskeyForm.get('email')?.value;
    const rememberMe = this.loginWithPasskeyForm.get('rememberMe')?.value;

    if (!email) {
      this.loginError = 'Inserisci la tua email per usare la passkey';
      return;
    }

    this.passkeyLoading = true;
    this.loginError = '';

    try {
      await this.passkeyService.authenticate(email, rememberMe || false);
      this.passkeyLoading = false;
      this.router.navigate(['/admin/home']).catch(() => {
        this.loginError = 'Errore durante la navigazione. Riprova.';
      });
    } catch (error: any) {
      this.passkeyLoading = false;
      console.error(error);
      if (error?.name === 'NotAllowedError') {
        this.loginError = 'Autenticazione annullata dal dispositivo';
      } else if (error?.error?.message) {
        this.loginError = error.error.message;
      } else {
        this.loginError = 'Autenticazione con passkey fallita. Riprova.';
      }
    }
  }
}
