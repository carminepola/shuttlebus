import { Component, OnInit } from '@angular/core';
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
import { fadeAnimation } from '../../animations/fade.animation';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

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
export class MyTicketsComponent implements OnInit {
  bookings: any = [];
  url: string = '';
  constructor(
    private bookingsService: BookingsService,
    private lng: LngService,
    private stripeService: StripeService
  ) {}
  loading = true;

  async ngOnInit(): Promise<void> {
    this.url = window.location.origin;
    this.load();
  }
  async load() {
    let bookings: any = await lastValueFrom(
      this.bookingsService.getBookingFromUser()
    );
    console.log(bookings);

    this.bookings = bookings['booking'] || [];
    this.loading = false;
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
        confirmButton: 'btn btn-primary btn-lg mr-2',
        denyButton: 'btn btn-danger btn-lg',
        popup: 'rounded-4',
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
        popup: 'rounded-4',
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
  paga(url: string) {
    window.open(url);
  }
  async generatePDF(booking: any) {
    try {
      const doc = new jsPDF();

      // Imposta i margini di base
      const marginLeft = 20;
      let yPosition = 20;

      // Logo opzionale (se hai un logo, inserisci il percorso base64)
      try {
        const logoDataUrl = 'data:image/png;base64,...'; // Inserisci il logo base64 qui
        doc.addImage(logoDataUrl, 'PNG', marginLeft, yPosition, 40, 15);
        yPosition += 20;
      } catch (error) {
        console.warn('Errore nel caricamento del logo', error);
      }

      // Titolo del biglietto
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(this.lng.traslate('str_biglietto'), marginLeft, yPosition);
      yPosition += 10;

      // Linea divisoria
      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      doc.line(marginLeft, yPosition, 190, yPosition);
      yPosition += 10;

      // Informazioni sul biglietto
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `${this.lng.traslate('str_n_tickets')}: ${booking.numberOfTickets}`,
        marginLeft,
        yPosition
      );
      yPosition += 8;

      doc.text(
        `${this.lng.traslate('str_giorno')}: ${booking.date.split('-')[2]}/${
          booking.date.split('-')[1]
        }/${booking.date.split('-')[0]}`,
        marginLeft,
        yPosition
      );
      yPosition += 8;

      doc.text(
        `${this.lng.traslate('str_partenza_da')} ${booking.from.name} (${
          booking.from.stopTime
        })`,
        marginLeft,
        yPosition
      );
      yPosition += 8;

      doc.text(
        `${this.lng.traslate('str_arrivo_a')} ${booking.to.name} (${
          booking.to.stopTime
        })`,
        marginLeft,
        yPosition
      );
      yPosition += 10;

      // Linea divisoria
      doc.line(marginLeft, yPosition, 190, yPosition);
      yPosition += 10;

      // Biglietti dettagliati
      booking.ticketTypes.forEach((ticket: any) => {
        doc.text(
          `${ticket.name[this.lng.getLng()]}: ${ticket.count}`,
          marginLeft,
          yPosition
        );
        yPosition += 8;
      });

      // Bagagli
      if (booking.luggage > 0) {
        doc.text(
          `${this.lng.traslate('str_bagagli_aggiuntivi')}: ${booking.luggage}`,
          marginLeft,
          yPosition
        );
        yPosition += 8;
      }

      // Totale e stato del biglietto
      doc.setFont('helvetica', 'bold');
      doc.text(
        `${this.lng.traslate('str_totale')}: ${booking.total} €`,
        marginLeft,
        yPosition
      );
      yPosition += 8;

      // Generazione QR Code
      try {
        const qrCodeDataUrl = await QRCode.toDataURL(
          `${this.url}/ticket/check/${booking.id}`
        );
        doc.addImage(qrCodeDataUrl, 'PNG', marginLeft, yPosition, 50, 50);
        yPosition += 60;
      } catch (error) {
        console.error('Errore nella generazione del QR Code', error);
      }

      // Linea divisoria
      doc.line(marginLeft, yPosition, 190, yPosition);
      yPosition += 10;

      // Termini e condizioni
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text(
        this.lng.traslate('str_terms-and-conditions_title'),
        marginLeft,
        yPosition
      );
      yPosition += 5;
      doc.text(this.url + '/info/terms-and-conditions', marginLeft, yPosition);

      // Politica di rimborso
      yPosition += 8;
      doc.text(this.lng.traslate('str_policy_subtitle'), marginLeft, yPosition);
      yPosition += 5;
      doc.text(this.url + '/info/refund-policy', marginLeft, yPosition);

      // Salvataggio del biglietto
      doc.save(`biglietto_${booking.id}.pdf`);
    } catch (error) {
      alert(error);
    }
  }
}
