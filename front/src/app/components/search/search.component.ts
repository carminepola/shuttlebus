import { Component, OnInit, AfterViewInit, Input, ChangeDetectionStrategy } from '@angular/core';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { TranslateNamePipe } from '../../pipe/translateName.pipe';
import { lastValueFrom } from 'rxjs';
import { StopsService } from '../../services/stops/stops.service';
import { RoutesService } from '../../services/routes/routes.service';
import { TicketTypeService } from '../../services/ticket-type/ticket-type.service';
import { PendingBookingService } from '../../services/pending-booking/pending-booking.service';

import { Router } from '@angular/router';
import { FormsModule, NgForm, ReactiveFormsModule } from '@angular/forms';
import { fadeAnimation } from '../../animations/fade.animation';
import { LngService } from '../../services/lng/lng.service';
declare var bootstrap: any;
@Component({
  selector: 'app-search',
  imports: [TranslatePipe, TranslateNamePipe, ReactiveFormsModule, FormsModule],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeAnimation],
})
export class SearchComponent implements OnInit, AfterViewInit {
  @Input() ricerca?: {
    partenza?: string;
    arrivo?: string;
    data?: string;
    bagagli?: number;
    ticketSelections?: { [id: string]: number };
  };

  public today = new Date(
    Date.now() - new Date().getTimezoneOffset() * 60 * 1000
  )
    .toISOString()
    .split('T')[0];
  public routes: string[] = [];
  public stops: string[] = [];
  public allStop: any = [];
  public selectStart: any = [];
  public selectEnd: any = [];
  public ticketTypes: any[] = [];
  public selectedTickets: { [id: string]: number } = {};
  public errors: string[] = [];
  public maxTickets = 12;

  constructor(
    private routesService: RoutesService,
    private stopsService: StopsService,
    private ticketTypeService: TicketTypeService,
    private router: Router,
    private pendingBookingService: PendingBookingService,
    private lngService: LngService,
  ) {}

  ngAfterViewInit() {
    const tooltipTriggerList = document.querySelectorAll(
      '[data-bs-toggle="tooltip"]'
    );
    const tooltipList = [...tooltipTriggerList].map(
      (tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
    );
  }

  private readonly SESSION_KEY = 'shuttlebus_search';

  async ngOnInit(): Promise<void> {
    if (!this.ricerca) {
      const saved = sessionStorage.getItem(this.SESSION_KEY);
      if (saved) {
        try {
          this.ricerca = JSON.parse(saved);
          const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60 * 1000).toISOString().split('T')[0];
          if (this.ricerca?.data && this.ricerca.data < today) {
            this.ricerca!.data = today;
          }
        } catch {
          this.ricerca = undefined;
        }
      }
    }

    if (!this.ricerca) {
      this.ricerca = {
        partenza: '',
        arrivo: '',
        data: new Date(Date.now() - new Date().getTimezoneOffset() * 60 * 1000)
          .toISOString()
          .split('T')[0],
        bagagli: 0,
      };
    }

    if (this.ricerca.ticketSelections) {
      this.selectedTickets = { ...this.ricerca.ticketSelections };
    }

    let [risRoutes, risStops, risTicketTypes] = await Promise.all([
      lastValueFrom(this.routesService.getRoutes()),
      lastValueFrom(this.stopsService.getAllActiveStops()),
      lastValueFrom(this.ticketTypeService.getAllActiveTicketTypes()),
    ]);

    if (risStops.stops.length > 0 && risRoutes.routes.length > 0) {
      this.stops = risStops.stops;
      this.routes = risRoutes.routes;
      this.allStop = risStops.stops.map((stop: any) => {
        return {
          id: stop.id,
          name: stop.name,
          desc: stop.address,
        };
      });
      this.selectStart = this.selectEnd = this.allStop;
      setTimeout(() => {
        this.cambioPartenza();
      }, 10);
      setTimeout(() => {
        this.cambioArrivo();
      }, 10);
    }

    this.ticketTypes = risTicketTypes.ticketType || [];

    setTimeout(() => {
      const tooltipTriggerList = document.querySelectorAll(
        '[data-bs-toggle="tooltip"]'
      );
      [...tooltipTriggerList].forEach(
        (el) => new bootstrap.Tooltip(el)
      );
    }, 100);
  }

  getTotalPersone(): number {
    return Object.values(this.selectedTickets).reduce(
      (sum, count) => sum + count,
      0
    );
  }

  addTicketType(id: string) {
    if (this.getTotalPersone() >= this.maxTickets) {
      return;
    }
    this.selectedTickets[id] = (this.selectedTickets[id] || 0) + 1;
  }

  removeTicketType(id: string) {
    if (this.selectedTickets[id] && this.selectedTickets[id] > 0) {
      this.selectedTickets[id]--;
      if (this.selectedTickets[id] === 0) {
        delete this.selectedTickets[id];
      }
    }
  }

  cambioPartenza() {
    if (this.ricerca?.partenza) {
      let listaStazioni: string[] = [];

      for (let i = 0; i < this.routes.length; i++) {
        let route: any = this.routes[i];

        let index = route.stops.findIndex(
          (stop: any) => stop.id === this.ricerca?.partenza
        );
        if (index >= 0) {
          for (let j = index + 1; j < route.stops.length; j++) {
            if (
              !listaStazioni.includes(route.stops[j].id) &&
              route.stops[j].id != this.ricerca.partenza
            ) {
              listaStazioni.push(route.stops[j].id);
            }
          }
        }
      }

      let stazioni = this.allStop.filter((stop: any) =>
        listaStazioni.includes(stop.id)
      );

      this.selectEnd = stazioni.map((stop: any) => {
        return {
          id: stop.id,
          name: stop.name,
          desc: stop.address,
        };
      });
    } else {
      this.selectEnd = this.allStop;
    }
    let p = this.ricerca?.arrivo;
    this.ricerca!.arrivo = '';
    setTimeout(() => {
      this.ricerca!.arrivo = p;
    }, 10);
  }
  cambioArrivo() {
    if (this.ricerca?.arrivo) {
      let listaStazioni: string[] = [];

      for (let i = 0; i < this.routes.length; i++) {
        let route: any = this.routes[i];

        let index = route.stops.findIndex(
          (stop: any) => stop.id === this.ricerca?.arrivo
        );
        if (index >= 0) {
          for (let j = index - 1; j >= 0; j--) {
            if (
              !listaStazioni.includes(route.stops[j].id) &&
              route.stops[j].id != this.ricerca.arrivo
            ) {
              listaStazioni.push(route.stops[j].id);
            }
          }
        }
      }

      let stazioni = this.allStop.filter((stop: any) =>
        listaStazioni.includes(stop.id)
      );

      this.selectStart = stazioni.map((stop: any) => {
        return {
          id: stop.id,
          name: stop.name,
          desc: stop.address,
        };
      });
    } else {
      this.selectStart = this.allStop;
    }
    let p = this.ricerca?.partenza;
    this.ricerca!.partenza = '';
    setTimeout(() => {
      this.ricerca!.partenza = p;
    }, 10);
  }
  swapStops() {
    if (!this.ricerca) return;
    const tmpPartenza = this.ricerca.partenza;
    const tmpArrivo = this.ricerca.arrivo;
    this.ricerca.partenza = '';
    this.ricerca.arrivo = '';
    setTimeout(() => {
      this.ricerca!.partenza = tmpArrivo;
      this.ricerca!.arrivo = tmpPartenza;
      this.cambioPartenza();
      this.cambioArrivo();
    }, 10);
  }

  async onSubmit(f: NgForm) {
    this.errors = [];

    if (!this.ricerca?.partenza) {
      this.errors.push('str_err_partenza');
    }
    if (!this.ricerca?.arrivo) {
      this.errors.push('str_err_arrivo');
    }
    if (this.getTotalPersone() === 0) {
      this.errors.push('str_err_biglietti');
    }
    if (!this.ricerca?.data) {
      this.errors.push('str_err_data');
    }
    if (this.ricerca?.bagagli === undefined || this.ricerca?.bagagli === null) {
      this.errors.push('str_err_bagagli');
    }

    if (this.errors.length > 0) {
      return;
    }

    const pendingBooking =
      await this.pendingBookingService.hasPendingBooking();
    if (pendingBooking) {
      const shouldContinue =
        await this.pendingBookingService.showPendingModal();
      if (shouldContinue) {
        this.router.navigate(this.lngService.langPathArray('/user/mytickets'));
        return;
      } else {
        await this.pendingBookingService.cancelPendingBooking(pendingBooking);
      }
    }

    sessionStorage.setItem(
      this.SESSION_KEY,
      JSON.stringify({
        partenza: this.ricerca?.partenza,
        arrivo: this.ricerca?.arrivo,
        data: this.ricerca?.data,
        bagagli: this.ricerca?.bagagli,
        ticketSelections: this.selectedTickets,
      }),
    );

    let filteredTickets: { [id: string]: number } = {};
    for (let key in this.selectedTickets) {
      if (this.selectedTickets[key] > 0) {
        filteredTickets[key] = this.selectedTickets[key];
      }
    }

    this.router.navigate(this.lngService.langPathArray('/search'), {
      queryParams: {
        partenza: this.ricerca?.partenza,
        arrivo: this.ricerca?.arrivo,
        persone: this.getTotalPersone(),
        data: this.ricerca?.data,
        bagagli: this.ricerca?.bagagli,
        tickets: JSON.stringify(filteredTickets),
      },
    });
  }
  updateDate(event: string) {
    const dateObj = new Date(event);

    this.ricerca!.data = dateObj.toISOString().split('T')[0];
  }
}
