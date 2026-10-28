import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { UserService } from '../../services/user/user.service';
import { AuthService } from '../../services/auth/auth.service';
import { LngService } from '../../services/lng/lng.service';

type Step = 'idle' | 'confirm' | 'code';

/**
 * Cancellazione immediata dell'account. Serve un codice di conferma: app di
 * autenticazione (o codice di recupero) se attiva, altrimenti codice via email.
 */
@Component({
  selector: 'app-delete-account',
  imports: [FormsModule],
  templateUrl: './delete-account.component.html',
  styleUrl: './delete-account.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class DeleteAccountComponent {
  step: Step = 'idle';
  method: 'totp' | 'email' = 'email';
  understood = false;
  code = '';
  busy = false;
  error = '';
  info = '';

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private lng: LngService,
    private router: Router,
  ) {}

  t(key: string, fallback: string): string {
    return this.lng.traslateOr(key, fallback);
  }

  /** Ruoli staff/admin (< 100) non possono cancellarsi da soli. */
  canDelete(): boolean {
    const user = this.authService.getDecodedToken();
    return !!user && Number(user.role) >= 100;
  }

  open(): void {
    this.step = 'confirm';
    this.understood = false;
    this.code = '';
    this.error = '';
    this.info = '';
  }

  cancel(): void {
    this.step = 'idle';
    this.error = '';
    this.info = '';
  }

  async start(): Promise<void> {
    await this.run(async () => {
      const { method } = await lastValueFrom(this.userService.startDeleteAccount());
      this.method = method;
      this.step = 'code';
      if (method === 'email') {
        this.info = this.t('str_mfa_email_hint', 'Abbiamo inviato un codice a 6 cifre alla tua email.');
      }
    });
  }

  async resend(): Promise<void> {
    await this.run(async () => {
      await lastValueFrom(this.userService.startDeleteAccount());
      this.info = this.t('str_mfa_code_sent', 'Codice inviato');
    });
  }

  async confirm(): Promise<void> {
    await this.run(async () => {
      await lastValueFrom(this.userService.deleteAccount(this.code.trim()));
      this.authService.clearSession();
      this.router.navigate(['/']);
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      await action();
    } catch (e: any) {
      const message: string = e?.error?.message || '';
      if (e?.status === 429) {
        this.error = this.t('str_mfa_too_many', 'Troppi tentativi. Riprova più tardi.');
      } else if (message === 'str_account_delete_active_tickets') {
        this.error = this.t(
          message,
          'Hai biglietti confermati per oggi o per i prossimi giorni: annullali o attendi il viaggio prima di eliminare l\'account.',
        );
      } else if (message === 'str_account_delete_staff') {
        this.error = this.t(message, 'Gli account dello staff possono essere eliminati solo da un amministratore.');
      } else {
        this.error = message || this.t('str_generic_error', 'Si è verificato un errore. Riprova.');
      }
    } finally {
      this.busy = false;
    }
  }
}
