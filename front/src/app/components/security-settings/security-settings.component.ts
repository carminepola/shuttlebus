import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import QRCode from 'qrcode';
import { MfaService, MfaStatus } from '../../services/mfa/mfa.service';
import { LngService } from '../../services/lng/lng.service';

/** Flusso in corso nella card: attivazione/disattivazione di un fattore. */
type Pending = 'totp-enable' | 'totp-disable' | 'email-enable' | 'email-disable' | 'recovery-regenerate' | null;

/**
 * Sicurezza dell'account: verifica in due passaggi (app TOTP, email) e passkey.
 * Ogni modifica a un fattore richiede un codice valido di quel fattore.
 */
@Component({
  selector: 'app-security-settings',
  imports: [FormsModule, DatePipe, NgTemplateOutlet],
  templateUrl: './security-settings.component.html',
  styleUrl: './security-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class SecuritySettingsComponent implements OnInit {
  status: MfaStatus = { totp: false, email: false, recoveryCodes: 0, passkeys: [] };
  loading = true;
  busy = false;
  error = '';
  success = '';

  pending: Pending = null;
  code = '';
  totpQr = '';
  totpSecret = '';
  // Codici di recupero appena generati: mostrati UNA volta, il server conserva solo l'hash
  newRecoveryCodes: string[] | null = null;
  copied = false;

  passkeySupported = false;
  passkeyName = '';
  confirmRemoveId: string | null = null;

  constructor(
    private mfaService: MfaService,
    private lng: LngService,
  ) {}

  ngOnInit(): void {
    this.passkeySupported = this.mfaService.passkeySupported();
    this.loadStatus();
  }

  t(key: string, fallback: string): string {
    return this.lng.traslateOr(key, fallback);
  }

  loadStatus(): void {
    this.mfaService.getStatus().subscribe({
      next: (status) => {
        this.status = status;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = this.t('str_security_load_error', 'Impossibile caricare le impostazioni di sicurezza.');
      },
    });
  }

  // ------------------------------------------------------------ app (TOTP)

  async startTotpEnable(): Promise<void> {
    await this.run(async () => {
      const { secret, uri } = await lastValueFrom(this.mfaService.setupTotp());
      this.totpSecret = secret;
      this.totpQr = await QRCode.toDataURL(uri, { width: 200, margin: 1 });
      this.begin('totp-enable');
    });
  }

  startTotpDisable(): void {
    this.begin('totp-disable');
  }

  // ------------------------------------------------------------ email

  async startEmail(action: 'email-enable' | 'email-disable' | 'recovery-regenerate'): Promise<void> {
    await this.run(async () => {
      await lastValueFrom(this.mfaService.sendEmailCode());
      this.begin(action);
      this.success = this.t('str_mfa_code_sent', 'Codice inviato');
    });
  }

  async resendEmail(): Promise<void> {
    await this.run(async () => {
      await lastValueFrom(this.mfaService.sendEmailCode());
      this.success = this.t('str_mfa_code_sent', 'Codice inviato');
    });
  }

  // ------------------------------------------------------------ conferma codice

  async confirmCode(): Promise<void> {
    const code = this.code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) {
      this.error = this.t('str_mfa_invalid_code', 'Codice non valido');
      return;
    }
    const action = this.pending;
    await this.run(async () => {
      let codes: string[] | null = null;
      if (action === 'totp-enable') codes = (await lastValueFrom(this.mfaService.enableTotp(code))).recoveryCodes;
      if (action === 'totp-disable') await lastValueFrom(this.mfaService.disableTotp(code));
      if (action === 'email-enable') codes = (await lastValueFrom(this.mfaService.enableEmail(code))).recoveryCodes;
      if (action === 'email-disable') await lastValueFrom(this.mfaService.disableEmail(code));
      if (action === 'recovery-regenerate') {
        codes = (await lastValueFrom(this.mfaService.regenerateRecoveryCodes(this.status.totp ? 'totp' : 'email', code))).recoveryCodes;
      }
      this.cancel();
      if (codes?.length) {
        this.newRecoveryCodes = codes;
        this.copied = false;
      }
      this.success =
        action === 'recovery-regenerate'
          ? this.t('str_recovery_regenerated', 'Nuovi codici di recupero generati: i precedenti non sono più validi.')
          : action?.endsWith('enable')
            ? this.t('str_mfa_enabled_ok', 'Verifica in due passaggi attivata')
            : this.t('str_mfa_disabled_ok', 'Verifica in due passaggi disattivata');
      this.loadStatus();
    });
  }

  // ------------------------------------------------------------ codici di recupero

  async startRecoveryRegenerate(): Promise<void> {
    // conferma con l'app se attiva, altrimenti con un codice via email
    if (this.status.totp) {
      this.begin('recovery-regenerate');
      return;
    }
    await this.startEmail('recovery-regenerate');
  }

  async copyRecoveryCodes(): Promise<void> {
    if (!this.newRecoveryCodes) return;
    try {
      await navigator.clipboard.writeText(this.newRecoveryCodes.join('\n'));
      this.copied = true;
    } catch {
      // clipboard non disponibile (http, permessi): l'utente puo' copiarli a mano
    }
  }

  cancel(): void {
    this.pending = null;
    this.code = '';
    this.totpQr = '';
    this.totpSecret = '';
    this.error = '';
  }

  // ------------------------------------------------------------ passkey

  async addPasskey(): Promise<void> {
    await this.run(async () => {
      try {
        await this.mfaService.registerPasskey(this.passkeyName.trim() || this.defaultPasskeyName());
      } catch (e: any) {
        // annullamento dal dialogo del browser: nessun messaggio d'errore
        if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') return;
        if (e?.name === 'InvalidStateError') {
          throw { error: { message: this.t('str_passkey_exists', 'Questa passkey è già registrata.') } };
        }
        throw e;
      }
      this.passkeyName = '';
      this.success = this.t('str_passkey_added', 'Passkey aggiunta');
      this.loadStatus();
    });
  }

  async removePasskey(id: string): Promise<void> {
    await this.run(async () => {
      await lastValueFrom(this.mfaService.removePasskey(id));
      this.confirmRemoveId = null;
      this.success = this.t('str_passkey_removed', 'Passkey rimossa');
      this.loadStatus();
    });
  }

  private defaultPasskeyName(): string {
    const ua = navigator.userAgent;
    if (/iPhone|iPad/.test(ua)) return 'iPhone / iPad';
    if (/Android/.test(ua)) return 'Android';
    if (/Mac/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows';
    return 'Passkey';
  }

  // ------------------------------------------------------------ helper

  private begin(action: Pending): void {
    this.pending = action;
    this.code = '';
    this.error = '';
    this.success = '';
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    this.success = '';
    try {
      await action();
    } catch (e: any) {
      this.error =
        e?.status === 429
          ? this.t('str_mfa_too_many', 'Troppi tentativi. Riprova più tardi.')
          : e?.error?.message || this.t('str_generic_error', 'Si è verificato un errore. Riprova.');
    } finally {
      this.busy = false;
    }
  }
}
