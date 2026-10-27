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
import { OAuthProviders, OAuthProvidersService } from '../../services/oauth-providers/oauth-providers.service';
import { MfaChallenge, MfaService } from '../../services/mfa/mfa.service';
import { MfaChallengeComponent } from '../../components/mfa-challenge/mfa-challenge.component';
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, MfaChallengeComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [],
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  isSubmitted = false;
  loginError = '';
  isLoading = false;
  showPassword = false;
  // Pulsanti OAuth visibili SOLO se il provider e' configurato lato server.
  // Finche' l'elenco non arriva da /api/providers restano nascosti.
  oauthProviders: OAuthProviders = { google: false, microsoft: false, facebook: false, spotify: false };

  // Login a due passaggi: valorizzato quando la password e' corretta ma serve il secondo fattore
  mfaChallenge: MfaChallenge | null = null;
  passkeySupported = false;

  get hasOAuth(): boolean {
    return this.oauthProviders.google || this.oauthProviders.microsoft || this.oauthProviders.facebook || this.oauthProviders.spotify;
  }

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private googleAuthService: GoogleAuthService,
    private microsoftAuthService: MicrosoftAuthService,
    private facebookAuthService: FacebookAuthService,
    private spotifyAuthService: SpotifyAuthService,
    private oauthProvidersService: OAuthProvidersService,
    private mfaService: MfaService
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
    this.passkeySupported = this.mfaService.passkeySupported();
    this.oauthProvidersService.getProviders().subscribe({
      next: (response) => {
        this.oauthProviders = response.providers;
      },
      error: () => {
        // Provider non disponibili: nessun pulsante OAuth, resta il login classico
      },
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
          this.loginError = '';
          if (this.mfaService.isMfaChallenge(response)) {
            this.mfaChallenge = response;
            return;
          }
          this.completeLogin();
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

  onMfaVerified(): void {
    this.mfaChallenge = null;
    this.completeLogin();
  }

  async loginWithPasskey(): Promise<void> {
    this.loginError = '';
    this.isLoading = true;
    try {
      await this.mfaService.loginWithPasskey(this.loginForm.value.rememberMe);
      this.completeLogin();
    } catch (e: any) {
      // annullamento dal dialogo del browser: nessun messaggio d'errore
      if (e?.name !== 'NotAllowedError' && e?.name !== 'AbortError') {
        this.loginError = 'Accesso con passkey non riuscito.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  private completeLogin(): void {
    this.router.navigate(['/admin/home']).catch(() => {
      this.loginError = 'Errore durante la navigazione. Riprova.';
    });
  }
}
