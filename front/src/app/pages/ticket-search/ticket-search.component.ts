import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { BookingsService } from '../../services/bookings/bookings.service';
import { lastValueFrom } from 'rxjs';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { fadeAnimation } from '../../animations/fade.animation';

@Component({
  selector: 'app-ticket-search',
  imports: [CommonModule, FormsModule, TranslatePipe, TitlePageComponent, LoadingComponent],
  templateUrl: './ticket-search.component.html',
  styleUrl: './ticket-search.component.scss',
  animations: [fadeAnimation],
})
export class TicketSearchComponent implements OnInit, OnDestroy {
  ticketId: string = '';
  loading: boolean = false;
  scannerActive: boolean = false;
  private html5QrCode: Html5Qrcode | null = null;
  private scannerElementId = 'qr-reader';

  constructor(
    private router: Router,
    private bookingsService: BookingsService,
  ) {}

  async ngOnInit() {}

  async searchTicket() {
    if (!this.ticketId.trim()) return;
    this.loading = true;
    try {
      const result: any = await lastValueFrom(
        this.bookingsService.readBookingById(this.ticketId.trim())
      );
      if (result.bookings) {
        this.router.navigate(['/ticket/check', this.ticketId.trim()]);
      } else {
        this.router.navigate(['/ticket/check', this.ticketId.trim()]);
      }
    } catch {
      this.router.navigate(['/ticket/check', this.ticketId.trim()]);
    }
  }

  async startScanner() {
    if (this.scannerActive) {
      this.stopScanner();
      return;
    }

    this.html5QrCode = new Html5Qrcode(this.scannerElementId);

    try {
      await this.html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          this.onScanSuccess(decodedText);
        },
        () => {}
      );
      this.scannerActive = true;
    } catch (err) {
      console.error('Errore avvio scanner:', err);
    }
  }

  async onScanSuccess(decodedText: string) {
    if (this.html5QrCode) {
      try {
        const state = this.html5QrCode.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await this.html5QrCode.stop();
        }
      } catch {}
    }
    this.scannerActive = false;
    this.router.navigate(['/ticket/check', decodedText.trim()]);
  }

  async stopScanner() {
    if (this.html5QrCode) {
      try {
        const state = this.html5QrCode.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await this.html5QrCode.stop();
        }
      } catch {}
      this.html5QrCode.clear();
      this.html5QrCode = null;
    }
    this.scannerActive = false;
  }

  ngOnDestroy() {
    this.stopScanner();
  }
}
