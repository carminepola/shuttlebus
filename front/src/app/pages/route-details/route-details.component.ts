import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { FormsModule, ReactiveFormsModule, NgForm } from '@angular/forms';

import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { ActivatedRoute, Router } from '@angular/router';
import { RoutesService } from '../../services/routes/routes.service';
import { fadeAnimation } from '../../animations/fade.animation';
import { TicketTypeService } from '../../services/ticket-type/ticket-type.service';
import { StopsService } from '../../services/stops/stops.service';
import { Fare } from '../../utils/fares';
import { MultilangInputComponent } from '../../components/multilang-input/multilang-input.component';
import { TranslateNamePipe } from '../../pipe/translateName.pipe';
import { LngService } from '../../services/lng/lng.service';
@Component({
  selector: 'app-route-details',
  imports: [MultilangInputComponent, TranslateNamePipe, 
    TitlePageComponent,
    FormsModule,
    LoadingComponent,
    ReactiveFormsModule
],
  animations: [fadeAnimation],
  templateUrl: './route-details.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './route-details.component.scss',
})
export class RouteDetailsComponent implements OnInit {
  public loading: boolean = true;
  public errorMessage: string = '';
  public ticketSelected: string = '';
  public new: boolean = false;
  public routeForm: any = {
    name: {},
    stops: [],
    enabled: true,
    ticketTypes: [],
  };
  public stops: any[] = [];
  public ticket: any = [];
  public id: string = '';
  public stopSelected: string = '';
  // Tariffe per tratta: chiave "fromId|toId" -> ticketTypeId -> prezzo
  public fareGrid: Record<string, Record<string, number | null>> = {};
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private routeService: RoutesService,
    private ticketTypeService: TicketTypeService,
    private stopsService: StopsService,
    private lngService: LngService,
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.id = params['id'];
      if (this.id) {
        this.load(this.id);
      } else {
        this.new = true;
        this.loading = false;
      }
    });
    this.ticketTypeService.getAllActiveTicketTypes().subscribe((res) => {
      if (res) {
        this.ticket = res.ticketType;
      }
    });
    this.stopsService.getAllActiveStops().subscribe((res) => {
      if (res) {
        this.stops = res.stops;
      }
    });
  }
  getTicketFromId(id: string) {
    let ticket = this.ticket.find((t: any) => t.id === id);
    if (ticket) {
      return this.lngService.pick(ticket.name);
    }
    return 'Non trovato';
  }
  addTicket() {
    if (this.ticketSelected) {
      let find = this.routeForm.ticketTypes.find(
        (t: any) => t === this.ticketSelected
      );
      if (!find) {
        this.routeForm.ticketTypes.push(this.ticketSelected);
      }
    }
  }
  deleteTicket(id: any) {
    this.routeForm.ticketTypes = this.routeForm.ticketTypes.filter(
      (t: any) => t !== id
    );
  }

  addStop() {
    if (
      this.stopSelected &&
      this.routeForm.stops.find((t: any) => t.id === this.stopSelected) ===
        undefined
    ) {
      let find = this.stops.find((t: any) => t.id === this.stopSelected);
      if (find) {
        this.routeForm.stops.push({
          id: find.id,

          new: true,
        });
      }
    }
  }
  deleteStop(id: any) {
    this.routeForm.stops = this.routeForm.stops.filter((t: any) => t.id !== id);
  }

  moveStopUp(id: string) {
    let index = this.routeForm.stops.findIndex((t: any) => t.id === id);
    if (index > 0) {
      let element = this.routeForm.stops.splice(index, 1)[0];
      this.routeForm.stops.splice(index - 1, 0, element);
    }
  }
  moveStopDown(id: string) {
    let index = this.routeForm.stops.findIndex((t: any) => t.id === id);
    if (index < this.routeForm.stops.length - 1) {
      let element = this.routeForm.stops.splice(index, 1)[0];
      this.routeForm.stops.splice(index + 1, 0, element);
    }
  }
  getStopFromId(id: string) {
    let stop = this.stops.find((t: any) => t.id === id);
    if (stop) {
      return stop.name;
    }
    return 'Non trovato';
  }
  getTicketCost(id: string): number | null {
    const ticket = this.ticket.find((t: any) => t.id === id);
    return ticket ? ticket.cost : null;
  }

  /** Tutte le coppie origine -> destinazione nell'ordine attuale delle fermate. */
  farePairs(): { key: string; from: string; to: string }[] {
    const stops = this.routeForm.stops || [];
    const pairs = [];
    for (let i = 0; i < stops.length; i++) {
      for (let j = i + 1; j < stops.length; j++) {
        pairs.push({ key: `${stops[i].id}|${stops[j].id}`, from: stops[i].id, to: stops[j].id });
      }
    }
    return pairs;
  }

  getFare(key: string, typeId: string): number | null {
    return this.fareGrid[key]?.[typeId] ?? null;
  }

  setFare(key: string, typeId: string, value: any) {
    const n = value === '' || value === null || value === undefined ? null : Number(value);
    this.fareGrid[key] = { ...(this.fareGrid[key] || {}), [typeId]: n !== null && Number.isFinite(n) && n >= 0 ? n : null };
  }

  private loadFareGrid(fares: Fare[] | undefined) {
    this.fareGrid = {};
    for (const f of fares || []) {
      this.fareGrid[`${f.fromStopId}|${f.toStopId}`] = { ...f.prices };
    }
  }

  /** Solo coppie ancora valide (fermate e biglietti attuali) con almeno un prezzo. */
  private buildFares(): Fare[] {
    const fares: Fare[] = [];
    for (const pair of this.farePairs()) {
      const prices: Record<string, number> = {};
      for (const typeId of this.routeForm.ticketTypes) {
        const v = this.getFare(pair.key, typeId);
        if (v !== null) prices[typeId] = v;
      }
      if (Object.keys(prices).length > 0) {
        fares.push({ fromStopId: pair.from, toStopId: pair.to, prices });
      }
    }
    return fares;
  }

  load(id: string) {
    this.routeService.getRouteById(id).subscribe((res) => {
      this.loading = false;
      if (res && res.route) {
        this.routeForm = res.route;
        this.loadFareGrid(res.route.fares);
        this.cdr.detectChanges();
      }
    });
  }
  onSubmit(form: NgForm) {
    this.errorMessage = '';

    if (!form.valid) {
      return;
    }
    if (this.routeForm.stops.length === 0) {
      this.errorMessage = 'Devi inserire almeno una fermata';
      return;
    }
    if (this.routeForm.ticketTypes.length === 0) {
      this.errorMessage = 'Devi inserire almeno un biglietto';
      return;
    }
    this.loading = true;
    let obj = JSON.parse(JSON.stringify(this.routeForm));

    obj.stops = obj.stops.map((stop: any, index: number) => {
      const { new: _, ...s } = stop;
      return { position: index, ...s };
    });
    obj.fares = this.buildFares();

    if (this.new) {
      this.routeService.insertRoute(obj).subscribe({
        next: (response: any) => {
          this.loading = false;
          this.router.navigate(['admin/corse/']);
        },
        error: (e: any) => {
          this.loading = false;
          if (e.message) {
            this.errorMessage = e.message;
          }
        },
      });
    } else {
      this.routeService
        .updateRoute(
          obj.name,
          obj.stops,
          obj.ticketTypes,
          obj.id,
          obj.enabled,
          obj.fares
        )
        .subscribe({
          next: (response: any) => {
            this.loading = false;
            window.history.back();
          },
          error: (e: any) => {
            this.loading = false;
            if (e.message) {
              this.errorMessage = e.message;
            }
          },
        });
    }
  }
}
