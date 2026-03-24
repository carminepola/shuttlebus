import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { FormsModule, ReactiveFormsModule, NgForm } from '@angular/forms';

import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { ActivatedRoute, Router } from '@angular/router';
import { RoutesService } from '../../services/routes/routes.service';
import { fadeAnimation } from '../../animations/fade.animation';
import { TicketTypeService } from '../../services/ticket-type/ticket-type.service';
import { StopsService } from '../../services/stops/stops.service';
@Component({
  selector: 'app-schedule',
  imports: [
    TitlePageComponent,
    FormsModule,
    LoadingComponent,
    ReactiveFormsModule
],
  animations: [fadeAnimation],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss',
})
export class ScheduleComponent implements OnInit {
  public loading: boolean = true;
  public errorMessage: string = '';
  public stops: any[] = [];
  public ticket: any = [];
  public idRoute: string = '';
  public idSchedule: string = '';
  public new: boolean = false;

  public readRoute: any = {};
  public exceptionDate: string = '';
  public extraDate: string = '';
  public form: any = {
    startDate: '',
    endDate: '',
    daysOfWeek: [],
    departureTime: '08:00',
    arrivalTime: '10:30',
    totalSeats: 50,
    availableLuggage: 20,
    stops: [],
    excludedDates: [],
    extraDates: [],
    status: 'active',
    busId: '',
  };
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private routeService: RoutesService,
    private ticketTypeService: TicketTypeService,
    private stopsService: StopsService
  ) {}
  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.idRoute = params['idRoute'];
      this.idSchedule = params['idSchedule'];
      this.load(this.idRoute);
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
  dayOfWeek(day: number) {
    switch (day) {
      case 0:
        return 'Domenica';
      case 1:
        return 'Lunedì';
      case 2:
        return 'Martedì';
      case 3:
        return 'Mercoledì';
      case 4:
        return 'Giovedì';
      case 5:
        return 'Venerdì';
      case 6:
        return 'Sabato';
      default:
        return '';
    }
  }
  save() {}
  onDayChange(day: number) {
    if (this.form.daysOfWeek.includes(day)) {
      this.form.daysOfWeek = this.form.daysOfWeek.filter(
        (d: number) => d !== day
      );
    } else {
      this.form.daysOfWeek.push(day);
      this.form.daysOfWeek = JSON.parse(JSON.stringify(this.form.daysOfWeek));
    }
  }

  getStop(id: string) {
    if (!id) {
      return { name: '' };
    }
    if (!this.stops) return { name: '' };
    return this.stops.find((s: any) => s.id === id);
  }
  toggleStatus(i: number) {
    const index = i;
    if (index !== -1) {
      this.form.stops[index].status =
        this.form.stops[index].status === 'active' ? 'inactive' : 'active';
    }
  }
  load(id: string) {
    this.routeService.getRouteById(id).subscribe((res) => {
      this.loading = false;

      if (res && res.route) {
        this.readRoute = res.route;

        if (this.readRoute.schedules?.length > 0) {
          this.form =
            this.readRoute.schedules.find(
              (t: any) => t.id === this.idSchedule
            ) || this.form;
        } else {
          this.readRoute.schedules = [];
        }
        for (let i = 0; i < this.readRoute.stops.length; i++) {
          const stop = this.readRoute.stops[i];
          const existingStopIndex = this.form.stops.findIndex(
            (s: any) => s.id === stop.id
          );

          if (existingStopIndex === -1) {
            this.form.stops.push({
              id: stop.id,
              stopTime: '',
              status: 'active',
            });
          }
        }
        this.cdr.detectChanges();
      }
    });
  }

  onSubmit(f: NgForm) {
    this.errorMessage = '';
    if (f.invalid) {
      return;
    } else {
      const activeStops = this.form.stops.filter(
        (s: any) => s.status === 'active'
      );

      if (this.form.startDate > this.form.endDate) {
        this.errorMessage =
          'La data di inizio deve essere precedente alla data di fine';
        return;
      }

      for (let i = 0; i < activeStops.length; i++) {
        const stop = activeStops[i];
        const nextStop = activeStops[i + 1];
        if (nextStop) {
          if (stop.stopTime > nextStop.stopTime) {
            this.errorMessage = 'Le ore di arrivo devono essere successive';
            return;
          }
        }
      }

      let primaFermataAttiva = activeStops.find(
        (stop: any) => stop.status === 'active'
      );
      let ultimaFermataAttiva = activeStops
        .reverse()
        .find((stop: any) => stop.status === 'active');

      this.form.departureTime = primaFermataAttiva.stopTime;

      this.form.arrivalTime = ultimaFermataAttiva.stopTime;

      if (!this.idSchedule) {
        this.routeService
          .insertSchedule(this.form, this.idRoute)
          .subscribe((res) => {
            window.history.back();
          });
      } else {
        this.routeService
          .updateSchedule(this.idSchedule, this.form, this.idRoute)
          .subscribe((res) => {
            window.history.back();
          });
      }
    }
  }
}
