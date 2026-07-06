import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { BookingsService } from '../../services/bookings/bookings.service';
import { lastValueFrom } from 'rxjs';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { fadeAnimation } from '../../animations/fade.animation';
import { LngService } from '../../services/lng/lng.service';

@Component({
  selector: 'app-ticket-search',
  imports: [CommonModule, FormsModule, TitlePageComponent],
  templateUrl: './ticket-search.component.html',
  styleUrl: './ticket-search.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeAnimation],
})
export class TicketSearchComponent implements OnInit, OnDestroy {
  ticketId: string = '';
  loading: boolean = false;
  showScannerModal: boolean = false;
  private html5QrCode: Html5Qrcode | null = null;
  private scannerElementId = 'qr-reader';

  constructor(
    private router: Router,
    private bookingsService: BookingsService,
    private lngService: LngService,
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
        this.router.navigate(this.lngService.langPathArray('/ticket/check'), { queryParams: { id: this.ticketId.trim() } });
      } else {
        this.router.navigate(this.lngService.langPathArray('/ticket/check'), { queryParams: { id: this.ticketId.trim() } });
      }
    } catch {
      this.router.navigate(this.lngService.langPathArray('/ticket/check'), { queryParams: { id: this.ticketId.trim() } });
    }
  }

  async openScanner() {
    this.showScannerModal = true;
    document.body.style.overflow = 'hidden';

    await new Promise(resolve => setTimeout(resolve, 150));

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
    } catch (err) {
      console.error('Errore avvio scanner:', err);
      this.closeScanner();
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
    this.html5QrCode = null;
    this.showScannerModal = false;
    document.body.style.overflow = '';
    this.router.navigate(this.lngService.langPathArray('/ticket/check'), { queryParams: { id: decodedText.trim() } });
  }

  async closeScanner() {
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
    this.showScannerModal = false;
    document.body.style.overflow = '';
  }

  ngOnDestroy() {
    this.closeScanner();
  }
}
