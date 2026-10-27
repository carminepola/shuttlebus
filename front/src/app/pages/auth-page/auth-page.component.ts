import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { Router, ActivatedRoute } from '@angular/router';
import { GoogleAuthService } from '../../services/google-auth/google-auth.service';
import { AuthService } from '../../services/auth/auth.service';
import { Subject, switchMap, takeUntil, filter } from 'rxjs';
import { MfaChallenge, MfaService } from '../../services/mfa/mfa.service';
import { MfaChallengeComponent } from '../../components/mfa-challenge/mfa-challenge.component';

@Component({
  selector: 'app-auth-page',
  imports: [LoadingComponent, MfaChallengeComponent],
  templateUrl: './auth-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-page.component.scss',
})
export class AuthPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  // OAuth riuscito ma l'account ha la verifica in due passaggi attiva
  mfaChallenge: MfaChallenge | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private googleAuth: GoogleAuthService,
    private authService: AuthService,
    private mfaService: MfaService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    // Se l'utente è già autenticato (es. refresh della pagina dopo il login),
    // non rifare la chiamata getGoogleSession con un token ormai consumato.
    const existing = await this.authService.refreshSession();
    if (existing) {
      this.redirectAfterLogin();
      return;
    }

    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        filter((params) => !!params.get('id')),
        switchMap((params) => this.googleAuth.getSession(params.get('id') as string))
      )
      .subscribe({
        next: async (response: any) => {
          if (this.mfaService.isMfaChallenge(response)) {
            this.mfaChallenge = response;
            this.cdr.markForCheck();
            return;
          }
          await this.authService.refreshSession();
          this.redirectAfterLogin();
        },
        error: () => {
          this.router.navigateByUrl('/');
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async onMfaVerified(): Promise<void> {
    await this.authService.refreshSession();
    this.redirectAfterLogin();
  }

  onMfaCancelled(): void {
    localStorage.removeItem('authUrl');
    this.router.navigateByUrl('/');
  }

  private redirectAfterLogin(): void {
    let page = localStorage.getItem('authUrl');
    if (page) {
      localStorage.removeItem('authUrl');
      this.router.navigateByUrl(page);
      return;
    }
    let session = this.authService.getDecodedToken();
    if ((session?.role ?? 9999) <= 50) {
      this.router.navigateByUrl('/admin/home');
    } else {
      this.router.navigateByUrl('/user/account');
    }
  }
}
