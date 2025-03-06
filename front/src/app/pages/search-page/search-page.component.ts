import { Component, OnInit, AfterViewInit } from '@angular/core';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { lastValueFrom } from 'rxjs';
import { StopsService } from '../../services/stops/stops.service';
import { RoutesService } from '../../services/routes/routes.service';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule, NgForm, ReactiveFormsModule } from '@angular/forms';
import { SearchComponent } from '../../components/search/search.component';
import { BookingsService } from '../../services/bookings/bookings.service';
import { FooterComponent } from '../../components/footer/footer.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { TranslateNamePipe } from '../../pipe/translateName.pipe';
import { TicketTypeService } from '../../services/ticket-type/ticket-type.service';
import { LngService } from '../../services/lng/lng.service';
@Component({
  selector: 'app-search-page',
  imports: [
    LoadingComponent,
    SearchComponent,
    TranslatePipe,
    TranslateNamePipe,
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    FooterComponent,
    LoadingComponent,
  ],
  templateUrl: './search-page.component.html',
  styleUrl: './search-page.component.scss',
})
export class SearchPageComponent implements OnInit {
  public ticketTypes: any[] = [];
  public loading: boolean = true;
  public ricerca = {
    partenza: '',
    arrivo: '',
    persone: 0,
    data: '',
    bagagli: 0,
  };
  public ricercaFind = {
    partenza: '',
    arrivo: '',
    persone: 0,
    data: '',
    bagagli: 0,
  };

  public params: any = [];

  constructor(
    private lngService: LngService,
    private routesService: RoutesService,
    private stopsService: StopsService,
    private bookingService: BookingsService,
    private router: Router,
    private route: ActivatedRoute,
    private ticketTypeService: TicketTypeService
  ) {}

  ngAfterViewInit(): void {}
  async ngOnInit(): Promise<void> {
    this.route.params.subscribe((params) => {
      this.ricerca.partenza = params['partenza'];
      this.ricerca.arrivo = params['arrivo'];
      this.ricerca.persone = parseInt(params['persone']);
      this.ricerca.data = params['data'];
      this.ricerca.bagagli = parseInt(params['bagagli']);
      this.params = [];
      this.ricercaFind = JSON.parse(JSON.stringify(this.ricerca));
      this.load();
    });
  }

  addTicket(j: number, i: number) {
    this.params[j].seats++;
    this.params[j].ticketTypes[i].count++;
    this.params[j].total += this.params[j].ticketTypes[i].cost;
  }
  removeTicket(j: number, i: number) {
    this.params[j].ticketTypes[i].count--;
    this.params[j].seats--;
    this.params[j].total -= this.params[j].ticketTypes[i].cost;
  }
  removeLuggage(j: number) {
    this.params[j].total -= 2;
    this.params[j].luggage--;
  }
  addLuggage(j: number) {
    this.params[j].total += 2;
    this.params[j].luggage++;
  }

  async load() {
    this.params = [];
    let params = [];
    this.loading = true;

    let risTicketTypes = await lastValueFrom(
      this.ticketTypeService.getAllActiveTicketTypes()
    );
    let risRoutes = await lastValueFrom(this.routesService.getRoutes());
    let risStops = await lastValueFrom(this.stopsService.getAllActiveStops());
    let risBookings = await lastValueFrom(
      this.bookingService.findAvailableRoutes(
        this.ricerca.partenza,
        this.ricerca.arrivo,
        this.ricerca.persone,
        this.ricerca.data,
        this.ricerca.bagagli
      )
    );

    let ticketTypes = risTicketTypes.ticketType;
    let stops = risStops.stops;
    let routes = risRoutes.routes;
    let res = risBookings.result || [];
    for (let i = 0; i < res.length; i++) {
      let route: any = routes.find((t: any) => t.id === res[i].routeId);
      if (route && route.schedules) {
        let schedule = route?.schedules.find(
          (t: any) => t.id === res[i].scheduleId
        );

        let from: any = stops.find((t: any) => t.id === this.ricerca.partenza);
        let to: any = stops.find((t: any) => t.id === this.ricerca.arrivo);
        let info = {
          date: this.ricerca.data,
          id: res[i].routeId,
          total: 2 * this.ricerca.bagagli,
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
              (z: any) => z.id === this.ricerca.partenza
            ).stopTime,
          },

          to: {
            id: to.id,
            name: to.name,
            description: to.description,
            image: to.image,
            address: to.address,
            stopTime: schedule.stops.find(
              (z: any) => z.id === this.ricerca.arrivo
            ).stopTime,
          },
          ticketTypes: JSON.parse(
            JSON.stringify(
              ticketTypes.map((t: any) => {
                return ticketTypes.find((z: any) => z.id === t.id);
              })
            )
          ),
        };

        info.ticketTypes = info.ticketTypes.map((t: any) => {
          return {
            ...t,
            count: 0,
          };
        });

        params.push(info);
      }
    }

    if (
      new Date(this.ricerca.data).toDateString().split('T')[0] ==
      new Date().toDateString().split('T')[0]
    ) {
      params = params.filter((param: any) => {
        const [hour, minute] = param.from.stopTime.split(':');
        const [nowHour, nowMinute] = new Date()
          .toLocaleTimeString('it-IT')
          .split(':');

        let stopTime = parseInt(hour) * 60 + parseInt(minute);
        let nowTime = parseInt(nowHour) * 60 + parseInt(nowMinute);
        if (nowTime + 60 > stopTime) {
          return false;
        }

        return true;
      });
    }
    this.params = params;

    this.loading = false;
  }
  acquista(param: any) {
    param.ticketTypes = param.ticketTypes.filter((t: any) => t.count > 0);
    param.lng = this.lngService.getLng();
    delete param['to']['image'];
    delete param['from']['image'];
    delete param['availableSeats'];
    delete param['availableLuggage'];

    console.log(param);
    this.router.navigate(['/riepilogo'], { state: { value: param } });
  }
}
