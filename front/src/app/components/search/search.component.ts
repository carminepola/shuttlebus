import { Component, OnInit, AfterViewInit, Input, ChangeDetectionStrategy } from '@angular/core';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { TranslateNamePipe } from '../../pipe/translateName.pipe';
import { lastValueFrom } from 'rxjs';
import { StopsService } from '../../services/stops/stops.service';
import { BookingsService } from '../../services/bookings/bookings.service';
import { TicketTypeService } from '../../services/ticket-type/ticket-type.service';
import { PendingBookingService } from '../../services/pending-booking/pending-booking.service';
import { LngService } from '../../services/lng/lng.service';
import { daysLabel, isTicketTypeValidOn } from '../../utils/ticket-days';

import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule, NgForm, ReactiveFormsModule } from '@angular/forms';
import { fadeAnimation } from '../../animations/fade.animation';
declare var bootstrap: any;
@Component({
  selector: 'app-search',
  imports: [TranslatePipe, TranslateNamePipe, ReactiveFormsModule, FormsModule, DatePipe],
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
    ritorno?: string;
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
  public maxBagagli = 10;
  public andataRitorno = false;
  /** Prima data con corse per la tratta scelta: proposta sotto il campo data, non impostata. */
  public suggestedDate: string | null = null;
  /** Tratta scelta senza corse prenotabili. */
  public noRunsForStops = false;
  private suggestionRequest = 0;
  private suggestionTimer: any;

  constructor(
    private bookingsService: BookingsService,
    private stopsService: StopsService,
    private ticketTypeService: TicketTypeService,
    private router: Router,
    private pendingBookingService: PendingBookingService,
    public lngService: LngService,
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
          if (this.ricerca?.ritorno && this.ricerca.ritorno < this.ricerca.data!) {
            this.ricerca!.ritorno = this.ricerca!.data;
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

    this.andataRitorno = !!this.ricerca.ritorno;

    if (this.ricerca.ticketSelections) {
      this.selectedTickets = { ...this.ricerca.ticketSelections };
    }

    let [risSearchStops, risStops, risTicketTypes] = await Promise.all([
      lastValueFrom(this.bookingsService.searchStops()).catch(() => ({ sequences: [] as string[][] })),
      lastValueFrom(this.stopsService.getAllActiveStops()),
      lastValueFrom(this.ticketTypeService.getAllActiveTicketTypes()),
    ]);

    // solo le fermate delle corse con almeno una partenza futura prenotabile;
    // ogni sequenza e' l'ordine delle fermate di una corsa
    const sequences: string[][] = risSearchStops.sequences || [];
    const searchable = new Set(sequences.flat());
    if (risStops.stops.length > 0 && sequences.length > 0) {
      this.stops = risStops.stops;
      this.routes = sequences.map((seq) => ({ stops: seq.map((id) => ({ id })) })) as any;
      this.allStop = risStops.stops.filter((stop: any) => searchable.has(stop.id)).map((stop: any) => {
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

  /**
   * Biglietti della ricerca: solo quelli visibili in home e validi nella data di
   * andata (e, se presente, in quella di ritorno). Gli altri si aggiungono sulla corsa.
   */
  availableTicketTypes(): any[] {
    return this.ticketTypes.filter(
      (tt) =>
        tt.showOnHome !== false &&
        isTicketTypeValidOn(tt, this.ricerca?.data) &&
        (!this.andataRitorno || isTicketTypeValidOn(tt, this.ricerca?.ritorno)),
    );
  }

  ticketDaysLabel(tt: any): string {
    return daysLabel(tt.daysOfWeek, this.lngService.getLng());
  }

  /** Selezioni ancora valide per le date scelte (cambiando data un biglietto puo' sparire). */
  private validSelections(): { [id: string]: number } {
    const valid: { [id: string]: number } = {};
    for (const tt of this.availableTicketTypes()) {
      if (this.selectedTickets[tt.id] > 0) valid[tt.id] = this.selectedTickets[tt.id];
    }
    return valid;
  }

  getTotalPersone(): number {
    return Object.values(this.validSelections()).reduce(
      (sum, count) => sum + count,
      0
    );
  }

  addTicketType(id: string) {
    if (this.getTotalPersone() >= this.maxTickets) {
      return;
    }
    this.selectedTickets[id] = (this.selectedTickets[id] || 0) + 1;
    this.refreshSuggestedDate();
  }

  removeTicketType(id: string) {
    if (this.selectedTickets[id] && this.selectedTickets[id] > 0) {
      this.selectedTickets[id]--;
      if (this.selectedTickets[id] === 0) {
        delete this.selectedTickets[id];
      }
      this.refreshSuggestedDate();
    }
  }

  addBagagli() {
    if (!this.ricerca) return;
    const current = this.ricerca.bagagli ?? 0;
    if (current >= this.maxBagagli) return;
    this.ricerca.bagagli = current + 1;
    this.refreshSuggestedDate();
  }

  removeBagagli() {
    if (!this.ricerca) return;
    const current = this.ricerca.bagagli ?? 0;
    if (current <= 0) return;
    this.ricerca.bagagli = current - 1;
    this.refreshSuggestedDate();
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
      this.refreshSuggestedDate();
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
      this.refreshSuggestedDate();
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

  /**
   * Con partenza e arrivo scelti chiede al server il primo giorno con una corsa
   * prenotabile (posti e bagagli inclusi) e lo propone sotto la data, senza impostarlo.
   */
  refreshSuggestedDate() {
    clearTimeout(this.suggestionTimer);
    const from = this.ricerca?.partenza;
    const to = this.ricerca?.arrivo;
    const request = ++this.suggestionRequest;
    if (!from || !to) {
      this.suggestedDate = null;
      this.noRunsForStops = false;
      return;
    }
    this.suggestionTimer = setTimeout(async () => {
      try {
        const res = await lastValueFrom(
          this.bookingsService.nextAvailableDate(from, to, {
            posti: Math.max(this.getTotalPersone(), 1),
            bagagli: this.ricerca?.bagagli || 0,
          }),
        );
        if (request !== this.suggestionRequest) return; // risposta di una scelta precedente
        this.suggestedDate = res.date;
        this.noRunsForStops = !res.date;
      } catch {
        if (request !== this.suggestionRequest) return;
        this.suggestedDate = null;
        this.noRunsForStops = false;
      }
    }, 250);
  }

  useSuggestedDate() {
    if (this.suggestedDate) this.updateDate(this.suggestedDate);
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
    if (this.andataRitorno && (!this.ricerca?.ritorno || this.ricerca.ritorno < this.ricerca.data!)) {
      this.errors.push('str_err_data_ritorno');
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
        this.router.navigate(['/user/mytickets']);
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
        ritorno: this.ritorno,
        bagagli: this.ricerca?.bagagli,
        ticketSelections: this.selectedTickets,
      }),
    );

    let filteredTickets = this.validSelections();

    this.router.navigate(['/search'], {
      queryParams: {
        partenza: this.ricerca?.partenza,
        arrivo: this.ricerca?.arrivo,
        persone: this.getTotalPersone(),
        data: this.ricerca?.data,
        ritorno: this.ritorno,
        bagagli: this.ricerca?.bagagli,
        tickets: JSON.stringify(filteredTickets),
      },
    });
  }
  updateDate(event: string) {
    const dateObj = new Date(event);

    this.ricerca!.data = dateObj.toISOString().split('T')[0];
    if (this.ricerca!.ritorno && this.ricerca!.ritorno < this.ricerca!.data) {
      this.ricerca!.ritorno = this.ricerca!.data;
    }
  }

  setAndataRitorno(value: boolean) {
    this.andataRitorno = value;
    if (value && !this.ricerca!.ritorno) {
      this.ricerca!.ritorno = this.ricerca!.data;
    }
  }

  /** Data del ritorno, solo se e' stata scelta l'andata e ritorno. */
  get ritorno(): string | undefined {
    return this.andataRitorno ? this.ricerca?.ritorno : undefined;
  }

  errorText(err: string): string {
    return err === 'str_err_data_ritorno'
      ? this.lngService.traslateOr(err, 'Scegli una data di ritorno uguale o successiva all\'andata')
      : this.lngService.traslate(err);
  }
}
