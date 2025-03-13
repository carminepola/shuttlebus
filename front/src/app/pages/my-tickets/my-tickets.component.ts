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
@Component({
  selector: 'app-my-tickets',
  imports: [
    LoadingComponent,
    TranslatePipe,
    TranslateNamePipe,
    TitlePageComponent,
    CommonModule,
  ],
  templateUrl: './my-tickets.component.html',
  styleUrl: './my-tickets.component.scss',
})
export class MyTicketsComponent implements OnInit {
  bookings: any = [];
  constructor(
    private bookingsService: BookingsService,
    private lng: LngService,
    private stripeService: StripeService
  ) {}
  loading = true;
  async ngOnInit(): Promise<void> {
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
}
