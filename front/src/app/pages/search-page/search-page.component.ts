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
import { DatePipe } from '@angular/common';
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
    bagagli: 0,
  };
  public ricercaFind: any = {
    partenza: '',
    arrivo: '',
    data: '',
    bagagli: 0,
    ticketSelections: {} as { [id: string]: number },
  };
  public ticketSelections: { [id: string]: number } = {};
  public params: any = [];

  constructor(
    private lngService: LngService,
    private routesService: RoutesService,
    private stopsService: StopsService,
    private bookingService: BookingsService,
    private router: Router,
    private route: ActivatedRoute,
    private ticketTypeService: TicketTypeService,
    private pendingBookingService: PendingBookingService,
  ) {}

  ngAfterViewInit(): void {}
  async ngOnInit(): Promise<void> {
    this.route.queryParams.subscribe(
      (qParams) => {
        this.ricerca.partenza = qParams['partenza'] || '';
        this.ricerca.arrivo = qParams['arrivo'] || '';
        this.ricerca.persone = parseInt(qParams['persone']) || 0;
        this.ricerca.data = qParams['data'] || '';
        this.ricerca.bagagli = parseInt(qParams['bagagli']) || 0;
        this.ticketSelections = JSON.parse(qParams['tickets'] || '{}');
        this.params = [];
        this.ricercaFind = {
          partenza: this.ricerca.partenza,
          arrivo: this.ricerca.arrivo,
          data: this.ricerca.data,
          bagagli: this.ricerca.bagagli,
          ticketSelections: { ...this.ticketSelections },
        };

        this.load();
      },
    );
  }

  async load() {
    this.params = [];
    let params = [];
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
    let risBookings = await lastValueFrom(
      this.bookingService.findAvailableRoutes(
        this.ricerca.partenza,
        this.ricerca.arrivo,
        this.ricerca.persone,
        this.ricerca.data,
        this.ricerca.bagagli,
      ),
    );

    let ticketTypes = risTicketTypes.ticketType;
    let stops = risStops.stops;
    let routes = risRoutes.routes;
    let res = risBookings.result || [];
    for (let i = 0; i < res.length; i++) {
      let route: any = routes.find((t: any) => t.id === res[i].routeId);
      if (route && route.schedules) {
        let schedule = route?.schedules.find(
          (t: any) => t.id === res[i].scheduleId,
        );

        let from: any = stops.find((t: any) => t.id === this.ricerca.partenza);
        let to: any = stops.find((t: any) => t.id === this.ricerca.arrivo);
        let info = {
          date: this.ricerca.data,
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
              (z: any) => z.id === this.ricerca.partenza,
            ).stopTime,
          },

          to: {
            id: to.id,
            name: to.name,
            description: to.description,
            image: to.image,
            address: to.address,
            stopTime: schedule.stops.find(
              (z: any) => z.id === this.ricerca.arrivo,
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
      new Date(this.ricerca.data).toDateString() == new Date().toDateString()
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
    this.params = params;

    this.loading = false;
    const searchResult = document.getElementById('search-result');
    if (searchResult) {
      searchResult.scrollIntoView({ behavior: 'smooth' });
    }
  }
  acquista(param: any) {
    param.ticketTypes = param.ticketTypes.filter((t: any) => t.count > 0);
    param.lng = this.lngService.getLng();
    delete param['to']['image'];
    delete param['from']['image'];
    delete param['availableSeats'];
    delete param['availableLuggage'];

    this.router.navigate(['/riepilogo'], { state: { value: param } });
  }
}
