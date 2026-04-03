import { Component, OnInit, OnDestroy } from '@angular/core';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { TranslateNamePipe } from '../../pipe/translateName.pipe';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { CommonModule } from '@angular/common';
import { BookingsService } from '../../services/bookings/bookings.service';
import { lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { LngService } from '../../services/lng/lng.service';
import { StripeService } from '../../services/stripe/stripe.service';
import { PendingBookingService } from '../../services/pending-booking/pending-booking.service';
import { fadeAnimation } from '../../animations/fade.animation';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

const PENDING_EXPIRY_MS = 30 * 60 * 1000;

@Component({
  selector: 'app-my-tickets',
  imports: [
    LoadingComponent,
    TranslatePipe,
    TranslateNamePipe,
    TitlePageComponent,
    CommonModule,
  ],
  animations: [fadeAnimation],
  templateUrl: './my-tickets.component.html',
  styleUrl: './my-tickets.component.scss',
})
export class MyTicketsComponent implements OnInit, OnDestroy {
  bookings: any = [];
  activeBookings: any = [];
  oldBookings: any = [];
  showOldTickets = false;
  url: string = '';
  pendingCountdowns: { [key: string]: string } = {};
  private countdownInterval: any;
  private expiredReloadSet = new Set<string>();
  constructor(
    private bookingsService: BookingsService,
    private lng: LngService,
    private stripeService: StripeService,
    private pendingBookingService: PendingBookingService,
  ) {}
  loading = true;

  async ngOnInit(): Promise<void> {
    this.url = window.location.origin;
    this.load();
  }
  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }
  async load() {
    let bookings: any = await lastValueFrom(
      this.bookingsService.getBookingFromUser(),
    );
    console.log(bookings);

    this.bookings = bookings['booking'] || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    this.activeBookings = this.bookings.filter(
      (b: any) => new Date(b.date) >= today,
    );
    this.oldBookings = this.bookings.filter(
      (b: any) => new Date(b.date) < today,
    );
    this.loading = false;

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.updateCountdowns();
    this.countdownInterval = setInterval(() => this.updateCountdowns(), 1000);
  }

  private updateCountdowns() {
    const now = Date.now();
    const pendingBookings = [
      ...this.activeBookings,
      ...this.oldBookings,
    ].filter((b: any) => b.status === 'pending');

    let allExpired = pendingBookings.length === 0;
    let hasNewExpiry = false;

    for (const booking of pendingBookings) {
      const key = booking.numberOfTickets;
      const expiry = booking.createdAt + PENDING_EXPIRY_MS;
      const remaining = expiry - now;

      if (remaining <= 0) {
        delete this.pendingCountdowns[key];
        if (!this.expiredReloadSet.has(String(key))) {
          this.expiredReloadSet.add(String(key));
          hasNewExpiry = true;
        }
      } else {
        allExpired = false;
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        this.pendingCountdowns[key] =
          `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }

    if (hasNewExpiry) {
      this.load();
      return;
    }

    if (allExpired && this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }
  checkDay(date: any) {
    if (date) {
      let dataTicket = new Date(date);
      dataTicket.setDate(dataTicket.getDate() - 3);
      let now = new Date();

      if (dataTicket.getTime() > now.getTime()) {
        return true;
      }
    }
    return false;
  }
  annulla(numberOfTickets: number) {
    Swal.fire({
      title: this.lng.traslate('str_vuoi_cancellare'),
      showDenyButton: true,
      position: 'top',
      icon: 'warning',
      showClass: {
        popup: `
              animate__animated
              animate__slideInDown   
              animate__faster
            `,
      },
      hideClass: {
        popup: `
              animate__animated
              animate__slideOutUp
              animate__faster
            `,
      },
      customClass: {
        confirmButton: 'btn btn-secondary btn-lg mr-2 ',
        denyButton: 'btn btn-outline-secondary btn-lg',
        popup: 'rounded-4 glass',
      },

      showCancelButton: false,
      confirmButtonText: this.lng.traslate('str_confermo'),
      denyButtonText: `${this.lng.traslate('str_annulla')}`,
    }).then((result: any) => {
      /* Read more about isConfirmed, isDenied below */
      if (result.isConfirmed) {
        this.bookingsService
          .deleteBooking(numberOfTickets.toString())
          .subscribe(() => {
            this.load();
          });
      } else if (result.isDenied) {
      }
    });
  }
  rimborsa(numberOfTickets: number) {
    Swal.fire({
      title: this.lng.traslate('str_vuoi_annullare'),
      showDenyButton: true,
      position: 'top',
      icon: 'warning',
      showClass: {
        popup: `
              animate__animated
              animate__slideInDown   
              animate__faster
            `,
      },
      hideClass: {
        popup: `
              animate__animated
              animate__slideOutUp
              animate__faster
            `,
      },
      customClass: {
        confirmButton: 'btn btn-primary btn-lg mr-2',
        denyButton: 'btn btn-danger btn-lg',
        popup: 'rounded-4 glass',
      },

      showCancelButton: false,
      confirmButtonText: this.lng.traslate('str_confermo'),
      denyButtonText: `${this.lng.traslate('str_annulla')}`,
    }).then((result: any) => {
      /* Read more about isConfirmed, isDenied below */
      if (result.isConfirmed) {
        this.stripeService.refund(numberOfTickets.toString()).subscribe(() => {
          this.load();
        });
      } else if (result.isDenied) {
      }
    });
  }
  async paga(bookingId: string) {
    const pending = await this.pendingBookingService.hasPendingBooking();
    if (pending && String(pending.numberOfTickets) !== bookingId) {
      const confirmed = await this.pendingBookingService.showPendingModal();
      if (confirmed) return;
      await this.pendingBookingService.cancelPendingBooking(pending);
      this.load();
    }
    const booking = [...this.activeBookings, ...this.oldBookings].find(
      (b: any) => String(b.numberOfTickets) === bookingId,
    );
    if (booking?.other?.url) {
      window.open(booking.other.url);
    }
  }
  async generatePDF(booking: any) {
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const mx = 15;
      const contentWidth = pageWidth - mx * 2;
      let y = 0;

      const PRIMARY: [number, number, number] = [26, 16, 100];
      const SECONDARY: [number, number, number] = [236, 42, 122];
      const LIGHT_INDIGO: [number, number, number] = [243, 244, 255];
      const LIGHT_BLUE_LINE: [number, number, number] = [181, 183, 253];
      const GRAY_DARK: [number, number, number] = [29, 29, 32];
      const GRAY_MID: [number, number, number] = [107, 114, 128];
      const GRAY_LIGHT: [number, number, number] = [243, 244, 246];
      const WHITE: [number, number, number] = [255, 255, 255];
      const SUCCESS: [number, number, number] = [37, 134, 127];

      const formatDate = (dateStr: string) => {
        const parts = dateStr.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      };

      const drawGradientRect = (
        x: number,
        yy: number,
        w: number,
        h: number,
        color1: number[],
        color2: number[],
      ) => {
        const steps = 40;
        const stepH = h / steps;
        for (let i = 0; i < steps; i++) {
          const t = i / (steps - 1);
          const r = Math.round(color1[0] + (color2[0] - color1[0]) * t);
          const g = Math.round(color1[1] + (color2[1] - color1[1]) * t);
          const b = Math.round(color1[2] + (color2[2] - color1[2]) * t);
          doc.setFillColor(r, g, b);
          doc.rect(x, yy + i * stepH, w, stepH + 0.5, 'F');
        }
      };

      const roundedRect = (
        x: number,
        yy: number,
        w: number,
        h: number,
        r: number,
        style: string = 'S',
      ) => {
        doc.setDrawColor(...WHITE);
        doc.setFillColor(...WHITE);
        doc.roundedRect(x, yy, w, h, r, r, style);
      };

      // === HEADER GRADIENT BAR ===
      drawGradientRect(0, 0, pageWidth, 48, SECONDARY, SECONDARY);

      // Brand name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.setTextColor(...WHITE);
      doc.text('PINTOUR', mx, 22);

      // Ticket label top-right
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(255, 255, 255);
        doc.text('Ticket', pageWidth - mx, 18, {
        align: 'right',
      });

      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...WHITE);
      doc.text(`#${booking.numberOfTickets}`, pageWidth - mx, 30, {
        align: 'right',
      });

      y = 56;

      // === DATE CARD ===
      doc.setFillColor(...LIGHT_INDIGO);
      roundedRect(mx, y, contentWidth, 18, 3, 'F');
      doc.setFillColor(...PRIMARY);
      doc.roundedRect(mx, y, 4, 18, 2, 2, 'F');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PRIMARY);
      doc.text(this.lng.traslate('str_giorno').toUpperCase(), mx + 10, y + 8);

      doc.setFontSize(13);
      doc.setTextColor(...GRAY_DARK);
      doc.text(formatDate(booking.date), mx + 10, y + 14);

      // Day of week
      const dateObj = new Date(booking.date);
      const days = [
        'Domenica',
        'Lunedì',
        'Martedì',
        'Mercoledì',
        'Giovedì',
        'Venerdì',
        'Sabato',
      ];
      const months = [
        'Gennaio',
        'Febbraio',
        'Marzo',
        'Aprile',
        'Maggio',
        'Giugno',
        'Luglio',
        'Agosto',
        'Settembre',
        'Ottobre',
        'Novembre',
        'Dicembre',
      ];
      const dayStr = `${days[dateObj.getDay()]} ${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

      y += 24;

      // === ROUTE TIMELINE SECTION ===
      doc.setFillColor(...GRAY_LIGHT);
      roundedRect(mx, y, contentWidth, 44, 3, 'F');

      // Departure
      const depX = mx + 20;
      const timeY = y + 17;

      doc.setFillColor(...PRIMARY);
      doc.circle(depX, timeY - 2, 4, 'F');

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PRIMARY);
      doc.text(booking.from.stopTime, depX, timeY - 8, { align: 'center' });

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GRAY_DARK);
      const fromName = booking.from.name;
      const fromSplitName = doc.splitTextToSize(fromName, 50);
      doc.text(fromSplitName[0], depX, timeY + 10, { align: 'center' });

      doc.setFontSize(7);
      doc.setTextColor(...GRAY_MID);
      const fromDesc =
        booking.from.description?.[this.lng.getLng()] ||
        booking.from.description?.en ||
        '';
      if (fromDesc) {
        doc.text(fromDesc, depX, timeY + 16, { align: 'center' });
      }

      // Dashed line connecting departure and arrival
      const lineY = timeY - 2;
      const arrX = pageWidth - mx - 20;
      doc.setDrawColor(...PRIMARY);
      doc.setLineDashPattern([2, 2], 0);
      doc.setLineWidth(0.5);
      doc.line(depX + 8, lineY, arrX - 8, lineY);
      doc.setLineDashPattern([], 0);

      // Arrival
      doc.setFillColor(...SECONDARY);
      doc.circle(arrX, timeY - 2, 4, 'F');

      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...SECONDARY);
      doc.text(booking.to.stopTime, arrX, timeY - 8, { align: 'center' });

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GRAY_DARK);
      const toName = booking.to.name;
      const toSplitName = doc.splitTextToSize(toName, 50);
      doc.text(toSplitName[0], arrX, timeY + 10, { align: 'center' });

      doc.setFontSize(7);
      doc.setTextColor(...GRAY_MID);
      const toDesc =
        booking.to.description?.[this.lng.getLng()] ||
        booking.to.description?.en ||
        '';
      if (toDesc) {
        doc.text(toDesc, arrX, timeY + 16, { align: 'center' });
      }

      y += 50;

      // === TICKET DETAILS ===
      doc.setFillColor(...WHITE);
      doc.setDrawColor(...LIGHT_BLUE_LINE);
      doc.setLineWidth(0.3);
      roundedRect(mx, y, contentWidth, 10, 2, 'FD');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GRAY_MID);
      doc.text(this.lng.traslate('str_totale').toUpperCase(), mx + 4, y + 6.5);

      let detailsH = 10;
      booking.ticketTypes.forEach((ticket: any) => {
        doc.setFillColor(...WHITE);
        doc.setDrawColor(...LIGHT_BLUE_LINE);
        doc.rect(mx, y + detailsH, contentWidth, 8, 'FD');

        const name =
          ticket.name?.[this.lng.getLng()] || ticket.name?.en || ticket.name;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRAY_DARK);
        doc.text(name, mx + 6, y + detailsH + 5.5);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PRIMARY);
        doc.text(
          `x${ticket.count}`,
          mx + contentWidth - 8,
          y + detailsH + 5.5,
          {
            align: 'right',
          },
        );
        detailsH += 8;
      });

      if (booking.luggage > 0) {
        doc.setFillColor(...WHITE);
        doc.setDrawColor(...LIGHT_BLUE_LINE);
        doc.rect(mx, y + detailsH, contentWidth, 8, 'FD');

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRAY_DARK);
        doc.text(
          this.lng.traslate('str_bagagli_aggiuntivi'),
          mx + 6,
          y + detailsH + 5.5,
        );

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...PRIMARY);
        doc.text(
          `x${booking.luggage}`,
          mx + contentWidth - 8,
          y + detailsH + 5.5,
          {
            align: 'right',
          },
        );
        detailsH += 8;
      }

      // Total row
      doc.setFillColor(...LIGHT_INDIGO);
      doc.rect(mx, y + detailsH, contentWidth, 12, 'F');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GRAY_MID);
      doc.text(
        this.lng.traslate('str_totale').toUpperCase(),
        mx + 6,
        y + detailsH + 7.5,
      );

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PRIMARY);
      doc.text(`${booking.total}`, mx + contentWidth - 22, y + detailsH + 8.5, {
        align: 'right',
      });
      doc.setFontSize(10);
      doc.setTextColor(...GRAY_MID);
      doc.text('€', mx + contentWidth - 6, y + detailsH + 8.5);

      y += detailsH + 18;

      // === QR CODE + TEAR LINE ===
      doc.setDrawColor(...LIGHT_BLUE_LINE);
      doc.setLineDashPattern([1.5, 1.5], 0);
      doc.setLineWidth(0.2);
      doc.line(mx + 4, y - 1, pageWidth - mx - 4, y - 1);
      doc.setLineDashPattern([], 0);

      y += 6;

      // QR code section
      try {
        const qrCodeDataUrl = await QRCode.toDataURL(
          `${this.url}/ticket/check/${booking.numberOfTickets}`,
          { margin: 1, width: 300 },
        );

        const qrSize = 38;
        const qrX = (pageWidth - qrSize) / 2;
        const qrY = y;

        // QR white background with subtle border
        doc.setFillColor(...WHITE);
        doc.setDrawColor(...LIGHT_BLUE_LINE);
        doc.setLineWidth(0.3);
        doc.roundedRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 3, 3, 'FD');

        // Colored accent bar on top of QR
        doc.setFillColor(...PRIMARY);
        doc.rect(qrX - 4, qrY - 4, qrSize + 8, 2, 'F');

        doc.addImage(qrCodeDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

        // Scan instruction
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRAY_MID);
        doc.text('Scan to verify', pageWidth / 2, qrY + qrSize + 8, {
          align: 'center',
        });

        y = qrY + qrSize + 14;
      } catch (error) {
        console.error('Errore nella generazione del QR Code', error);
      }

      // === FOOTER ===
      const footerY = pageHeight - 28;

      doc.setDrawColor(...LIGHT_BLUE_LINE);
      doc.setLineWidth(0.15);
      doc.line(mx, footerY - 2, mx + contentWidth, footerY - 2);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY_MID);

      const termsLabel =
        this.lng.traslate('str_terms-and-conditions_title') ||
        'Terms & Conditions';
      const policyLabel =
        this.lng.traslate('str_policy_subtitle') || 'Refund Policy';

      doc.textWithLink(
        `${termsLabel}: ${this.url}/info/terms-and-conditions`,
        mx,
        footerY + 2,
        { url: `${this.url}/info/terms-and-conditions` },
      );

      doc.textWithLink(
        `${policyLabel}: ${this.url}/info/refund-policy`,
        mx,
        footerY + 7,
        { url: `${this.url}/info/refund-policy` },
      );

      doc.text(this.url, mx, footerY + 12);

      doc.save(`biglietto_${booking.numberOfTickets}.pdf`);
    } catch (error) {
      alert(error);
    }
  }
}
