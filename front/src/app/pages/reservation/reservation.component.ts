import { Component, OnInit } from '@angular/core';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { Route } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StopsService } from '../../services/stops/stops.service';
import { BookingsService } from '../../services/bookings/bookings.service';
import { RoutesService } from '../../services/routes/routes.service';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { lastValueFrom } from 'rxjs';
import { TicketTypeService } from '../../services/ticket-type/ticket-type.service';
import { TranslateNamePipe } from '../../pipe/translateName.pipe';
import { UserService } from '../../services/user/user.service';
import { fadeAnimation } from '../../animations/fade.animation';
import { StripeService } from '../../services/stripe/stripe.service';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { FilterPipe } from '../../pipe/filter.pipe';
import Swal from 'sweetalert2';
@Component({
  selector: 'app-reservation',
  imports: [
    TitlePageComponent,
    TranslatePipe,
    LoadingComponent,
    CommonModule,
    TranslateNamePipe,
    FormsModule,
  ],
  animations: [fadeAnimation],
  templateUrl: './reservation.component.html',
  styleUrl: './reservation.component.scss',
})
export class ReservationComponent implements OnInit {
  public loading: boolean = true;

  public booking: any = [];
  public ticketTypes: any[] = [];
  public routes: any[] = [];
  public stops: any[] = [];
  public search: string = '';
  public filter: any = {
    date: new Date().toISOString().split('T')[0],
    routeId: '',
    scheduleId: '',
    show: 'confirmed',
  };
  public filterSchedule: any = [];

  constructor(
    public stopsService: StopsService,
    public routesService: RoutesService,
    public bookingsService: BookingsService,
    public ticketTypeService: TicketTypeService,
    public stripeService: StripeService
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading = true;

    let risTicketTypes = await lastValueFrom(
      this.ticketTypeService.getAllActiveTicketTypes()
    );
    let routes = await lastValueFrom(this.routesService.getRoutes());
    this.routes = routes.routes || [];
    this.stops = await lastValueFrom(this.stopsService.getAllActiveStops());

    this.filterButton();
  }
  rimborsa(numberOfTickets: number) {
    Swal.fire({
      title: 'Vuoi rimborsare questo biglietto?',
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
      confirmButtonText: 'Confermo',
      denyButtonText: `Annulla`,
    }).then((result: any) => {
      /* Read more about isConfirmed, isDenied below */
      if (result.isConfirmed) {
        this.stripeService.refund(numberOfTickets.toString()).subscribe(() => {
          let bookIndex = this.booking.findIndex(
            (b: any) => b.ticketId === numberOfTickets
          );
          this.booking[bookIndex].status = 'refunded';
        });
      } else if (result.isDenied) {
      }
    });
  }
  cancella(numberOfTickets: number) {
    Swal.fire({
      title: 'Vuoi cancellare questo biglietto?',
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
      confirmButtonText: 'Confermo',
      denyButtonText: `Annulla`,
    }).then((result: any) => {
      /* Read more about isConfirmed, isDenied below */
      if (result.isConfirmed) {
        this.bookingsService
          .cancelBooking(numberOfTickets.toString())
          .subscribe(() => {
            let bookIndex = this.booking.findIndex(
              (b: any) => b.ticketId === numberOfTickets
            );
            this.booking[bookIndex].status = 'cancelled';
          });
      } else if (result.isDenied) {
      }
    });
  }
  calculateSchedules(routeId: string) {
    if (routeId === '') this.filterSchedule = [];
    let route = this.routes.find((t: any) => t.id === routeId);
    let ris = route?.schedules.map((s: any) => {
      return {
        name: s.departureTime + ' - ' + s.arrivalTime,
        id: s.id,
      };
    });

    this.filterSchedule = ris;
  }
  async filterButton() {
    this.booking = [];
    this.loading = true;
    let ris: any = await lastValueFrom(
      this.bookingsService.readBookingConfirmed(
        this.filter.date,
        this.filter.routeId,
        this.filter.scheduleId,
        this.filter.show
      )
    );
    ris = ris.ticket || [];

    this.booking = ris.map((t: any) => {
      return {
        total: t.total,
        ticketId: t.numberOfTickets,
        status: t.status,
        paymentMethod: t.paymentMethod,
        ticket: t.ticketTypes,
        route: t.name.it,
        from: t.from.name + ' (' + t.from.stopTime + ')',
        to: t.to.name + ' (' + t.to.stopTime + ')',
        name: t.user.name,
        mail: t.user.mail,
        phone: t.user.phone,
        bagagli: t.luggage,
      };
    });

    setTimeout(() => {
      this.loading = false;
    }, 300);
  }
}
