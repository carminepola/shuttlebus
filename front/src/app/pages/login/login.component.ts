import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { GoogleAuthService } from '../../services/google-auth/google-auth.service';
import { MicrosoftAuthService } from '../../services/microsoft-auth/microsoft-auth.service';
import { FacebookAuthService } from '../../services/facebook-auth/facebook-auth.service';
import { SpotifyAuthService } from '../../services/spotify-auth/spotify-auth.service';
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [],
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  isSubmitted = false;
  loginError = '';
  isLoading = false;
  showPassword = false;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private googleAuthService: GoogleAuthService,
    private microsoftAuthService: MicrosoftAuthService,
    private facebookAuthService: FacebookAuthService,
    private spotifyAuthService: SpotifyAuthService
  ) {}

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/admin/home']);
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
  loginWithGoogle() {
    localStorage.setItem('authUrl', '/admin/home');
    this.googleAuthService.loginWithGoogle();
  }
  loginWithMicrosoft() {
    localStorage.setItem('authUrl', '/admin/home');
    this.microsoftAuthService.loginWithMicrosoft();
  }
  loginWithFacebook() {
    localStorage.setItem('authUrl', '/admin/home');
    this.facebookAuthService.loginWithFacebook();
  }
  loginWithSpotify() {
    localStorage.setItem('authUrl', '/admin/home');
    this.spotifyAuthService.loginWithSpotify();
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

      this.authService.login(email, password, rememberMe).subscribe({
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
}
