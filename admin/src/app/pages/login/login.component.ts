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
import * as CryptoJS from 'crypto-js';

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

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService: AuthService

  ) { }

  ngOnInit(): void {

    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/home']);
    }
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false],
    });
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
          this.router
            .navigate(['/home'])
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
          this.loginError = "Credenziali non valide. Riprova.";
        },
      });
    } catch (e: any) {
      this.isLoading = false;
      console.error(e);
      this.loginError = 'Errore durante la navigazione. Riprova.';
    }
  }
}
