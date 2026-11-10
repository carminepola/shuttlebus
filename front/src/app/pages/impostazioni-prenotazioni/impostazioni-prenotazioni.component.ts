import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import {
  BookingSettings,
  BookingSettingsService,
  DEFAULT_BOOKING_SETTINGS,
} from '../../services/bookingSettings/booking-settings.service';

@Component({
  selector: 'app-impostazioni-prenotazioni',
  imports: [TitlePageComponent, LoadingComponent, FormsModule],
  templateUrl: './impostazioni-prenotazioni.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './impostazioni-prenotazioni.component.scss',
})
export class ImpostazioniPrenotazioniComponent implements OnInit {
  settings: BookingSettings = { ...DEFAULT_BOOKING_SETTINGS };
  loading = true;
  salvando = false;
  mostraMessaggio = false;
  tipoMessaggio: 'success' | 'error' = 'success';
  messaggio = '';

  constructor(
    public router: Router,
    private bookingSettingsService: BookingSettingsService,
  ) {}

  async ngOnInit() {
    try {
      this.settings = { ...(await lastValueFrom(this.bookingSettingsService.get(true))) };
    } catch (err: any) {
      this.mostra('error', 'Errore nel caricamento delle impostazioni: ' + (err?.message || 'Errore sconosciuto'));
    }
    this.loading = false;
  }

  /** "2 ore prima della partenza", "il giorno prima alla stessa ora", ... */
  get cutoffLabel(): string {
    const m = Number(this.settings.bookingCutoffMinutes);
    if (!Number.isFinite(m) || m < 0) return '';
    if (m === 0) return 'fino alla partenza';
    if (m % 1440 === 0) return m === 1440 ? 'il giorno prima alla stessa ora' : `${m / 1440} giorni prima alla stessa ora`;
    if (m % 60 === 0) return m === 60 ? "un'ora prima della partenza" : `${m / 60} ore prima della partenza`;
    return `${m} minuti prima della partenza`;
  }

  get refundLabel(): string {
    const d = Number(this.settings.refundCutoffDays);
    if (!Number.isFinite(d) || d < 0) return '';
    if (d === 0) return 'fino al giorno prima della corsa';
    return d === 1 ? 'fino a 1 giorno prima della corsa' : `fino a ${d} giorni prima della corsa`;
  }

  async salva() {
    this.salvando = true;
    try {
      await lastValueFrom(
        this.bookingSettingsService.patch({
          bookingCutoffMinutes: Number(this.settings.bookingCutoffMinutes),
          refundCutoffDays: Number(this.settings.refundCutoffDays),
        }),
      );
      this.mostra('success', 'Impostazioni salvate con successo!');
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Errore sconosciuto';
      this.mostra('error', 'Errore nel salvataggio delle impostazioni: ' + msg);
    }
    this.salvando = false;
  }

  private mostra(tipo: 'success' | 'error', messaggio: string) {
    this.tipoMessaggio = tipo;
    this.messaggio = messaggio;
    this.mostraMessaggio = true;
    setTimeout(() => (this.mostraMessaggio = false), 5000);
  }
}
