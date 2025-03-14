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
@Component({
  selector: 'app-reservation',
  imports: [
    TitlePageComponent,
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
  };
  public filterSchedule: any = [];

  constructor(
    public stopsService: StopsService,
    public routesService: RoutesService,
    public bookingsService: BookingsService,
    public ticketTypeService: TicketTypeService
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
        this.filter.scheduleId
      )
    );
    ris = ris.ticket || [];

    this.booking = ris.map((t: any) => {
      return {
        total: t.total,
        ticketId: t.numberOfTickets,
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

    this.loading = false;
  }
}
