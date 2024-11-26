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

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  get formControls() {
    return this.loginForm.controls;
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    this.isSubmitted = true;

    if (this.loginForm.invalid) {
      return;
    }

    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: (response: any) => {
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
        console.error(e);
        //'Credenziali non valide. Riprova.'
        this.loginError = e.error.error.message;
      },
    });
  }
}
