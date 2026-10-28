import { Component, OnInit, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { lastValueFrom } from 'rxjs';
import { StopsService } from '../../services/stops/stops.service';
import { RoutesService } from '../../services/routes/routes.service';

import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule, NgForm, ReactiveFormsModule } from '@angular/forms';
import { SearchComponent } from '../../components/search/search.component';
import { BookingsService } from '../../services/bookings/bookings.service';
import { FooterComponent } from '../../components/footer/footer.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { TranslateNamePipe } from '../../pipe/translateName.pipe';
import { TicketTypeService } from '../../services/ticket-type/ticket-type.service';
import { LngService } from '../../services/lng/lng.service';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { fadeAnimation } from '../../animations/fade.animation';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { PendingBookingService } from '../../services/pending-booking/pending-booking.service';
import { LUGGAGE_PRICE } from '../../constants/app.constants';
import { StepIndicatorComponent } from '../../components/step-indicator/step-indicator.component';
@Component({
  selector: 'app-search-page',
  imports: [
    LoadingComponent,
    SearchComponent,
    TitlePageComponent,
    StepIndicatorComponent,
    TranslatePipe,
    TranslateNamePipe,
    ReactiveFormsModule,
    FormsModule,
    FooterComponent,
    LoadingComponent,
    DatePipe,
    NgTemplateOutlet,
  ],
  animations: [fadeAnimation],
  templateUrl: './search-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './search-page.component.scss',
})
export class SearchPageComponent implements OnInit {
  public luggagePrice = LUGGAGE_PRICE;
  public funnelSteps = ['str_step_search', 'str_step_select', 'str_step_review', 'str_step_pay'];
  public ticketTypes: any[] = [];
  public loading: boolean = true;
  public ricerca = {
    partenza: '',
    arrivo: '',
    persone: 0,
    data: '',
    ritorno: '',
    bagagli: 0,
  };
  public ricercaFind: any = {
    partenza: '',
    arrivo: '',
    data: '',
    ritorno: '',
    bagagli: 0,
    ticketSelections: {} as { [id: string]: number },
  };
  public ticketSelections: { [id: string]: number } = {};
  public params: any = [];
  // Andata e ritorno: corse del ritorno (fermate invertite) e corse scelte
  public returnParams: any = [];
  public selectedOutbound: any = null;
  public selectedReturn: any = null;

  constructor(
    private routesService: RoutesService,
    private stopsService: StopsService,
    private bookingService: BookingsService,
    private router: Router,
    private route: ActivatedRoute,
    private ticketTypeService: TicketTypeService,
    private pendingBookingService: PendingBookingService,
    public lngService: LngService,
  ) {}

  ngAfterViewInit(): void {}
  async ngOnInit(): Promise<void> {
    this.route.queryParams.subscribe(
      (qParams) => {
        this.ricerca.partenza = qParams['partenza'] || '';
        this.ricerca.arrivo = qParams['arrivo'] || '';
        this.ricerca.persone = parseInt(qParams['persone']) || 0;
        this.ricerca.data = qParams['data'] || '';
        this.ricerca.ritorno = qParams['ritorno'] || '';
        this.ricerca.bagagli = parseInt(qParams['bagagli']) || 0;
        this.ticketSelections = JSON.parse(qParams['tickets'] || '{}');
        this.params = [];
        this.ricercaFind = {
          partenza: this.ricerca.partenza,
          arrivo: this.ricerca.arrivo,
          data: this.ricerca.data,
          ritorno: this.ricerca.ritorno,
          bagagli: this.ricerca.bagagli,
          ticketSelections: { ...this.ticketSelections },
        };

        this.load();
      },
    );
  }

  get andataRitorno(): boolean {
    return !!this.ricerca.ritorno;
  }

  async load() {
    this.params = [];
    this.returnParams = [];
    this.selectedOutbound = null;
    this.selectedReturn = null;
    this.loading = true;

    const pendingBooking =
      await this.pendingBookingService.hasPendingBooking();
    if (pendingBooking) {
      const shouldContinue =
        await this.pendingBookingService.showPendingModal();
      if (shouldContinue) {
        this.router.navigate(['/user/mytickets']);
        return;
      } else {
        await this.pendingBookingService.cancelPendingBooking(pendingBooking);
      }
    }

    let risTicketTypes = await lastValueFrom(
      this.ticketTypeService.getAllActiveTicketTypes(),
    );
    let risRoutes = await lastValueFrom(this.routesService.getRoutes());
    let risStops = await lastValueFrom(this.stopsService.getAllActiveStops());
    const ticketTypes = risTicketTypes.ticketType;
    const stops = risStops.stops;
    const routes = risRoutes.routes;

    const [outbound, inbound] = await Promise.all([
      this.findTrips(this.ricerca.partenza, this.ricerca.arrivo, this.ricerca.data, ticketTypes, stops, routes),
      this.andataRitorno
        ? this.findTrips(this.ricerca.arrivo, this.ricerca.partenza, this.ricerca.ritorno, ticketTypes, stops, routes)
        : Promise.resolve([]),
    ]);
    this.params = outbound;
    this.returnParams = inbound;

    this.loading = false;
    const searchResult = document.getElementById('search-result');
    if (searchResult) {
      searchResult.scrollIntoView({ behavior: 'smooth' });
    }
  }

  private async findTrips(
    fromId: string,
    toId: string,
    date: string,
    ticketTypes: any[],
    stops: any[],
    routes: any[],
  ) {
    let params = [];
    let risBookings = await lastValueFrom(
      this.bookingService.findAvailableRoutes(
        fromId,
        toId,
        this.ricerca.persone,
        date,
        this.ricerca.bagagli,
      ),
    );

    let res = risBookings.result || [];
    for (let i = 0; i < res.length; i++) {
      let route: any = routes.find((t: any) => t.id === res[i].routeId);
      if (route && route.schedules) {
        let schedule = route?.schedules.find(
          (t: any) => t.id === res[i].scheduleId,
        );

        let from: any = stops.find((t: any) => t.id === fromId);
        let to: any = stops.find((t: any) => t.id === toId);
        let info = {
          date: date,
          routeId: res[i].routeId,
          scheduleId: res[i].scheduleId,
          total: LUGGAGE_PRICE * this.ricerca.bagagli,
          luggage: this.ricerca.bagagli,
          seats: 0,
          availableSeats: res[i].availableSeats || 0,
          availableLuggage: res[i].availableLuggage || 0,
          name: route.name,
          from: {
            id: from.id,
            name: from.name,
            description: from.description,
            image: from.image,
            address: from.address,
            stopTime: schedule.stops.find(
              (z: any) => z.id === fromId,
            ).stopTime,
          },

          to: {
            id: to.id,
            name: to.name,
            description: to.description,
            image: to.image,
            address: to.address,
            stopTime: schedule.stops.find(
              (z: any) => z.id === toId,
            ).stopTime,
          },
          ticketTypes: JSON.parse(
            JSON.stringify(
              ticketTypes.map((t: any) => {
                return ticketTypes.find((z: any) => z.id === t.id);
              }),
            ),
          ),
        };

        info.ticketTypes = info.ticketTypes.map((t: any) => {
          return {
            ...t,
            count: this.ticketSelections[t.id] || 0,
          };
        });

        info.total += info.ticketTypes.reduce(
          (sum: number, t: any) => sum + t.count * t.cost,
          0,
        );
        info.seats = info.ticketTypes.reduce(
          (sum: number, t: any) => sum + t.count,
          0,
        );

        params.push(info);
      }
    }

    if (
      new Date(date).toDateString() == new Date().toDateString()
    ) {
      params = params.filter((param: any) => {
        let route: any = routes.find((t: any) => t.id === param.routeId);
        if (route) {
          let schedule = route?.schedules.find(
            (t: any) => t.id === param.scheduleId,
          );
          if (!schedule) {
            return false;
          } else {
            const [hour, minute] = schedule.departureTime.split(':');
            const [nowHour, nowMinute] = new Date()
              .toLocaleTimeString('it-IT')
              .split(':');
            let stopTime = parseInt(hour) * 60 + parseInt(minute);
            let nowTime = parseInt(nowHour) * 60 + parseInt(nowMinute);
            if (nowTime + 120 > stopTime) {
              return false;
            }
          }
        }

        return true;
      });
    }

    return params;
  }

  /** Stesso giorno: il ritorno non puo' partire prima dell'arrivo dell'andata. */
  isReturnBeforeOutbound(param: any): boolean {
    return (
      !!this.selectedOutbound &&
      param.date === this.selectedOutbound.date &&
      param.from.stopTime < this.selectedOutbound.to.stopTime
    );
  }

  selectOutbound(param: any) {
    this.selectedOutbound = this.selectedOutbound === param ? null : param;
    if (this.selectedReturn && this.isReturnBeforeOutbound(this.selectedReturn)) {
      this.selectedReturn = null;
    }
    if (this.selectedOutbound && !this.selectedReturn) {
      document.getElementById('return-results')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  selectReturn(param: any) {
    if (this.isReturnBeforeOutbound(param)) return;
    this.selectedReturn = this.selectedReturn === param ? null : param;
  }

  isSelected(param: any, leg: string | null): boolean {
    return (
      (leg === 'outbound' && this.selectedOutbound === param) ||
      (leg === 'return' && this.selectedReturn === param)
    );
  }

  get roundTripTotal(): number {
    return (this.selectedOutbound?.total || 0) + (this.selectedReturn?.total || 0);
  }

  acquistaAndataRitorno() {
    if (!this.selectedOutbound || !this.selectedReturn) return;
    const outbound = this.prepareTicket({ ...this.selectedOutbound });
    outbound.returnTrip = this.prepareTicket({ ...this.selectedReturn });
    this.router.navigate(['/riepilogo'], { state: { value: outbound } });
  }

  private prepareTicket(param: any) {
    param.ticketTypes = param.ticketTypes.filter((t: any) => t.count > 0);
    param.lng = this.lngService.getLng();
    param.from = { ...param.from };
    param.to = { ...param.to };
    delete param['to']['image'];
    delete param['from']['image'];
    delete param['availableSeats'];
    delete param['availableLuggage'];
    return param;
  }

  acquista(param: any) {
    this.router.navigate(['/riepilogo'], {
      state: { value: this.prepareTicket(param) },
    });
  }
}
