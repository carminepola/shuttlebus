import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UpperCasePipe } from '@angular/common';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { fadeAnimation } from '../../animations/fade.animation';
import { TestEmailService } from '../../services/testEmail/test-email.service';

@Component({
  selector: 'app-test-email',
  imports: [TitlePageComponent, FormsModule, UpperCasePipe],
  templateUrl: './test-email.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './test-email.component.scss',
  animations: [fadeAnimation],
})
export class TestEmailComponent {
  types = [
    { value: 'WELCOME', label: 'Benvenuto (WELCOME)' },
    { value: 'RECOVER_PASSWORD', label: 'Recupero password' },
    { value: 'PURCHASE_COMPLETED', label: 'Acquisto completato' },
    { value: 'PURCHASE_CANCELLED', label: 'Acquisto annullato' },
    { value: 'REFUND_PROCESSED', label: 'Rimborso' },
    { value: 'GENERIC', label: 'Generica' },
  ];
  languages = ['it', 'en', 'fr', 'de', 'es', 'jp'];

  selectedType = 'WELCOME';
  selectedLng = 'it';
  to = '';
  helloTo = '';

  inviando = false;
  inviandoHello = false;
  mostraMessaggio = false;
  tipoMessaggio: 'success' | 'danger' = 'success';
  messaggio = '';

  constructor(private testEmailService: TestEmailService) {}

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
