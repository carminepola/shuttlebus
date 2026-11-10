import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { fadeAnimation } from '../../animations/fade.animation';
import { BookingsService } from '../../services/bookings/bookings.service';
import { RoutesService } from '../../services/routes/routes.service';
import { StopsService } from '../../services/stops/stops.service';
import { TicketTypeService } from '../../services/ticket-type/ticket-type.service';
import { UserService } from '../../services/user/user.service';
import { resolveFarePrice, resolveLuggagePrice } from '../../utils/fares';
import { daysLabel, isTicketTypeValidOn } from '../../utils/ticket-days';
import { PricePipe } from '../../pipe/price.pipe';

/**
 * Emissione di un biglietto dal pannello admin per un cliente registrato
 * o per una persona senza account (nome + mail). Il prezzo e' ricalcolato dal server.
 */
import { LanguagesService } from '../../services/languages/languages.service';
import { localToday } from '../../utils/dates';
@Component({
  selector: 'app-admin-new-ticket',
  imports: [PricePipe, TitlePageComponent, LoadingComponent, FormsModule],
  animations: [fadeAnimation],
  templateUrl: './admin-new-ticket.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class AdminNewTicketComponent implements OnInit {
  loading = true;
  saving = false;
  searching = false;
  errorMessage = '';
  successMessage = '';

  // Cliente
  customerMode: 'registered' | 'new' = 'registered';
  userSearch = '';
  userResults: any[] = [];
  selectedUser: any = null;
  newCustomer = { name: '', email: '', phone: '' };
  lng = '';
  get languages() {
    return this.languagesService.enabled;
  }

  // Viaggio
  routes: any[] = [];
  stops: any[] = [];
  ticketTypes: any[] = [];
  from = '';
  to = '';
  date = localToday();
  luggage = 0;
  selections: Record<string, number> = {};
  trips: any[] = [];
  selectedTrip: any = null;
  searched = false;

  // Pagamento
  paymentMode: 'cash' | 'free' = 'cash';
  sendMail = true;

  private static readonly ERRORS: Record<string, string> = {
    str_error_seats: 'Posti non più disponibili su questa corsa',
    str_error_luggage: 'Spazio bagagli non più disponibile',
    str_error_check_price: 'Prezzo o tipo di biglietto non valido per questa data',
    str_error_time: 'Data non valida',
  };

  constructor(
    private languagesService: LanguagesService,
    private bookingsService: BookingsService,
    private routesService: RoutesService,
    private stopsService: StopsService,
    private ticketTypeService: TicketTypeService,
    private userService: UserService,
    private router: Router,
  ) {
    this.lng = this.languagesService.defaultLanguage;
  }

  async ngOnInit() {
    try {
      const [r, s, t] = await Promise.all([
        lastValueFrom(this.routesService.getRoutes()),
        lastValueFrom(this.stopsService.getAllActiveStops()),
        lastValueFrom(this.ticketTypeService.getAllActiveTicketTypes()),
      ]);
      this.routes = (r.routes || []).filter((x: any) => x.enabled);
      this.stops = s.stops || [];
      this.ticketTypes = t.ticketType || [];
    } catch {
      this.errorMessage = 'Impossibile caricare corse e biglietti';
    }
    this.loading = false;
  }

  // ---- Cliente ----
  async searchUsers() {
    this.selectedUser = null;
    if (!this.userSearch.trim()) {
      this.userResults = [];
      return;
    }
    const res = await lastValueFrom(this.userService.searchClients(this.userSearch.trim(), 1, 10));
    this.userResults = res?.users || [];
  }

  selectUser(u: any) {
    this.selectedUser = u;
    this.userResults = [];
  }

  // ---- Viaggio ----
  /** Fermate di arrivo raggiungibili dalla partenza scelta. */
  arrivalStops(): any[] {
    if (!this.from) return this.stops;
    const ids = new Set<string>();
    for (const route of this.routes) {
      const i = route.stops.findIndex((s: any) => s.id === this.from);
      if (i < 0) continue;
      for (let j = i + 1; j < route.stops.length; j++) ids.add(route.stops[j].id);
    }
    return this.stops.filter((s) => ids.has(s.id));
  }

  stopName(id: string): string {
    return this.stops.find((s) => s.id === id)?.name || '';
  }

  availableTicketTypes(): any[] {
    return this.ticketTypes.filter((t) => isTicketTypeValidOn(t, this.date));
  }

  ticketDays(t: any): string {
    return daysLabel(t.daysOfWeek);
  }

  seats(): number {
    return this.availableTicketTypes().reduce((sum, t) => sum + (this.selections[t.id] || 0), 0);
  }

  changeCount(id: string, delta: number) {
    this.selections[id] = Math.max(0, (this.selections[id] || 0) + delta);
    this.resetTrips();
  }

  changeLuggage(delta: number) {
    this.luggage = Math.max(0, this.luggage + delta);
    this.resetTrips();
  }

  resetTrips() {
    this.trips = [];
    this.selectedTrip = null;
    this.searched = false;
  }

  async searchTrips() {
    this.errorMessage = '';
    this.resetTrips();
    if (!this.from || !this.to || !this.date) {
      this.errorMessage = 'Seleziona partenza, arrivo e data';
      return;
    }
    if (this.seats() === 0) {
      this.errorMessage = 'Aggiungi almeno un biglietto';
      return;
    }
    this.searching = true;
    try {
      const res = await lastValueFrom(
        this.bookingsService.adminFindAvailableRoutes(this.from, this.to, this.seats(), this.date, this.luggage),
      );
      this.trips = (res.result || []).map((r: any) => this.buildTrip(r)).filter(Boolean);
      this.trips.sort((a, b) => (a.from.stopTime || '').localeCompare(b.from.stopTime || ''));
    } catch {
      this.errorMessage = 'Errore nella ricerca delle corse';
    }
    this.searched = true;
    this.searching = false;
  }

  /** Stessa struttura del biglietto costruito dalla ricerca cliente (search-page). */
  private buildTrip(r: any) {
    const route = this.routes.find((x) => x.id === r.routeId);
    const schedule = route?.schedules?.find((x: any) => x.id === r.scheduleId);
    const from = this.stops.find((s) => s.id === this.from);
    const to = this.stops.find((s) => s.id === this.to);
    if (!route || !schedule || !from || !to) return null;
    // la corsa deve accettare tutti i biglietti scelti (corse senza tipi associati: tutti)
    const allowed: string[] = route.ticketTypes || [];
    const selected = this.availableTicketTypes().filter((t) => (this.selections[t.id] || 0) > 0);
    if (allowed.length > 0 && selected.some((t) => !allowed.includes(t.id))) return null;
    const stopTime = (id: string) => schedule.stops.find((z: any) => z.id === id)?.stopTime;
    const ticketTypes = this.availableTicketTypes()
      .filter((t) => (this.selections[t.id] || 0) > 0)
      .map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        cost: resolveFarePrice(route, this.from, this.to, t),
        count: this.selections[t.id],
      }));
    const total = Math.round((ticketTypes.reduce((s, t) => s + t.cost * t.count, 0) + resolveLuggagePrice(schedule) * this.luggage) * 100) / 100;
    return {
      date: this.date,
      routeId: route.id,
      scheduleId: schedule.id,
      name: route.name,
      total,
      luggage: this.luggage,
      seats: this.seats(),
      availableSeats: r.availableSeats,
      from: { id: from.id, name: from.name, description: from.description, address: from.address, stopTime: stopTime(from.id) },
      to: { id: to.id, name: to.name, description: to.description, address: to.address, stopTime: stopTime(to.id) },
      ticketTypes,
    };
  }

  // ---- Emissione ----
  total(): number {
    if (!this.selectedTrip) return 0;
    return this.paymentMode === 'free' ? 0 : this.selectedTrip.total;
  }

  customerReady(): boolean {
    if (this.customerMode === 'registered') return !!this.selectedUser;
    return !!this.newCustomer.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.newCustomer.email.trim());
  }

  async submit() {
    this.errorMessage = '';
    this.successMessage = '';
    if (!this.customerReady()) {
      this.errorMessage = 'Indica il cliente (registrato o nome + mail valida)';
      return;
    }
    if (!this.selectedTrip) {
      this.errorMessage = 'Seleziona una corsa';
      return;
    }
    const { availableSeats, ...ticket } = this.selectedTrip;
    const customer =
      this.customerMode === 'registered'
        ? { userId: this.selectedUser._id }
        : { name: this.newCustomer.name.trim(), email: this.newCustomer.email.trim(), phone: this.newCustomer.phone.trim() || undefined };

    this.saving = true;
    try {
      const res = await lastValueFrom(
        this.bookingsService.adminCreateBooking({
          ticket: { ...ticket, lng: this.lng },
          customer,
          paymentMode: this.paymentMode,
          sendMail: this.sendMail,
        }),
      );
      const codes = (res?.bookings || []).join(', ');
      this.successMessage =
        `Biglietto ${codes} emesso` +
        (this.sendMail ? ' e inviato via mail' : '') +
        (res?.guest ? '. Il cliente non ha un account: lo ritroverà registrandosi con la stessa mail.' : '.');
      this.resetTrips();
      this.selections = {};
      this.luggage = 0;
    } catch (e: any) {
      const key = e?.error?.message || e?.message;
      this.errorMessage = AdminNewTicketComponent.ERRORS[key] || key || 'Errore durante l\'emissione';
    }
    this.saving = false;
  }

  goToReservations() {
    this.router.navigate(['/admin/prenotazioni']);
  }
}
