import { Component, EventEmitter, Input, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { MfaChallenge, MfaLoginMethod, MfaMethod, MfaService } from '../../services/mfa/mfa.service';
import { LngService } from '../../services/lng/lng.service';

/**
 * Secondo passaggio del login (password o OAuth gia' verificati): chiede il
 * codice dell'app o quello ricevuto via email e, se corretto, il server crea
 * la sessione. Il genitore ricarica l'identita' su (verified).
 */
@Component({
  selector: 'app-mfa-challenge',
  imports: [FormsModule],
  templateUrl: './mfa-challenge.component.html',
  styleUrl: './mfa-challenge.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class MfaChallengeComponent implements OnInit {
  @Input({ required: true }) challenge!: MfaChallenge;
  @Output() verified = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  method: MfaLoginMethod = 'totp';
  code = '';
  loading = false;
  error = '';
  info = '';
  private emailSent = false;

  constructor(
    private mfaService: MfaService,
    public lng: LngService,
  ) {}

  ngOnInit(): void {
    this.method = this.challenge.methods[0];
    // Con il solo metodo email il server ha gia' inviato il codice
    this.emailSent = this.method === 'email';
  }

  t(key: string, fallback: string): string {
    return this.lng.traslateOr(key, fallback);
  }

  selectMethod(method: MfaLoginMethod): void {
    if (this.method === method) return;
    this.method = method;
    this.code = '';
    this.error = '';
    this.info = '';
    if (method === 'email' && !this.emailSent) {
      this.resendEmail();
    }
  }

  async resendEmail(): Promise<void> {
    this.error = '';
    try {
      await lastValueFrom(this.mfaService.resendLoginEmail(this.challenge.mfaToken));
      this.emailSent = true;
      this.info = this.t('str_mfa_code_sent', 'Codice inviato');
    } catch (e: any) {
      this.error = this.errorMessage(e);
    }
  }

  async submit(): Promise<void> {
    const code = this.code.replace(/\s/g, '');
    const valid = this.method === 'recovery' ? /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/.test(code) : /^\d{6}$/.test(code);
    if (!valid || this.loading) {
      this.error = this.t('str_mfa_invalid_code', 'Codice non valido');
      return;
    }
    this.loading = true;
    this.error = '';
    this.info = '';
    try {
      await lastValueFrom(this.mfaService.verifyLogin(this.challenge.mfaToken, this.method, code));
      this.verified.emit();
    } catch (e: any) {
      this.code = '';
      this.error = this.errorMessage(e);
    } finally {
      this.loading = false;
    }
  }

  private errorMessage(e: any): string {
    if (e?.status === 401) return this.t('str_mfa_expired', "Verifica scaduta: effettua di nuovo l'accesso.");
    if (e?.status === 429) return this.t('str_mfa_too_many', 'Troppi tentativi. Riprova più tardi.');
    if (e?.status === 503) return e?.error?.message || this.t('str_generic_error', 'Si è verificato un errore. Riprova.');
    return this.t('str_mfa_invalid_code', 'Codice non valido');
  }
}
