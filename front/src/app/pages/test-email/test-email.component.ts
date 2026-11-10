import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UpperCasePipe } from '@angular/common';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { fadeAnimation } from '../../animations/fade.animation';
import { TestEmailService } from '../../services/testEmail/test-email.service';
import { LanguagesService } from '../../services/languages/languages.service';

@Component({
  selector: 'app-test-email',
  imports: [TitlePageComponent, FormsModule, UpperCasePipe],
  templateUrl: './test-email.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './test-email.component.scss',
  animations: [fadeAnimation],
})
export class TestEmailComponent {
  /** Nomi leggibili dei tipi noti; i tipi nuovi compaiono col loro codice. */
  private readonly labels: Record<string, string> = {
    WELCOME: 'Benvenuto (PIN di verifica)',
    RECOVER_PASSWORD: 'Recupero password',
    PURCHASE_COMPLETED: 'Acquisto completato',
    PURCHASE_CANCELLED: 'Acquisto annullato',
    REFUND_PROCESSED: 'Rimborso',
    MFA_CODE: 'Codice di verifica (2FA)',
    ACCOUNT_DELETED: 'Account eliminato',
    GENERIC: 'Generica',
  };
  types: { value: string; label: string }[] = Object.entries(this.labels).map(([value, label]) => ({ value, label }));
  /** Tutte le lingue configurate (anche disattivate, per provarne le mail). */
  get languages(): string[] {
    return this.languagesService.all.map((l) => l.code);
  }

  selectedType = 'WELCOME';
  selectedLng = 'it';
  to = '';
  helloTo = '';

  inviando = false;
  inviandoHello = false;
  mostraMessaggio = false;
  tipoMessaggio: 'success' | 'danger' = 'success';
  messaggio = '';

  constructor(
    private testEmailService: TestEmailService,
    private languagesService: LanguagesService,
  ) {
    this.testEmailService.getTypes().subscribe({
      next: (res) => (this.types = (res?.types || []).map((value) => ({ value, label: this.labels[value] || value }))),
      error: () => {},
    });
  }

  private mostra(tipo: 'success' | 'danger', msg: string) {
    this.tipoMessaggio = tipo;
    this.messaggio = msg;
    this.mostraMessaggio = true;
  }

  inviaTemplate() {
    if (!this.to) {
      this.mostra('danger', 'Inserisci un indirizzo email destinatario');
      return;
    }
    this.inviando = true;
    this.mostraMessaggio = false;
    this.testEmailService
      .sendTemplate(this.selectedType, this.to, this.selectedLng)
      .subscribe({
        next: (res) => {
          this.inviando = false;
          this.mostra(
            'success',
            res?.message || 'Email di test inviata correttamente',
          );
        },
        error: (err) => {
          this.inviando = false;
          this.mostra('danger', err?.message || 'Invio email fallito');
        },
      });
  }

  inviaHello() {
    if (!this.helloTo) {
      this.mostra('danger', 'Inserisci un indirizzo email destinatario');
      return;
    }
    this.inviandoHello = true;
    this.mostraMessaggio = false;
    this.testEmailService.sendHello(this.helloTo).subscribe({
      next: (res) => {
        this.inviandoHello = false;
        this.mostra(
          'success',
          res?.message || 'Email di test inviata correttamente',
        );
      },
      error: (err) => {
        this.inviandoHello = false;
        this.mostra('danger', err?.message || 'Invio email fallito');
      },
    });
  }
}
