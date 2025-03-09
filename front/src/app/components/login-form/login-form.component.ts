import { Component, OnInit, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import * as CryptoJS from 'crypto-js';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { GoogleAuthService } from '../../services/google-auth/google-auth.service';
declare var bootstrap: any;

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TranslatePipe],
  templateUrl: './login-form.component.html',
  styleUrl: './login-form.component.scss',
})
export class LoginFormComponent implements OnInit {
  loginForm!: FormGroup;
  isSubmitted = false;
  loginError = '';
  isLoading = false;
  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private googleAuthService: GoogleAuthService
  ) {}
  @Output() loginSuccess = new EventEmitter<void>();

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      //this.router.navigate(['/admin/home']);
    }
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false],
    });
  }
  loginWithGoogle() {
    this.googleAuthService.loginWithGoogle();
  }
  get formControls() {
    return this.loginForm.controls;
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
          debugger;

          // this.router.navigate(['/user/account']);

          this.loginSuccess.emit();
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
}
