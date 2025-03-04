import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { FormsModule, ReactiveFormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { ActivatedRoute, Router } from '@angular/router';
import { RoutesService } from '../../services/routes/routes.service';
import { fadeAnimation } from '../../animations/fade.animation';
import { TicketTypeService } from '../../services/ticket-type/ticket-type.service';
import { StopsService } from '../../services/stops/stops.service';
@Component({
  selector: 'app-route-details',
  imports: [
    CommonModule,
    TitlePageComponent,
    FormsModule,
    LoadingComponent,
    ReactiveFormsModule,
  ],
  animations: [fadeAnimation],
  templateUrl: './route-details.component.html',
  styleUrl: './route-details.component.scss',
})
export class RouteDetailsComponent implements OnInit {
  public loading: boolean = true;
  public errorMessage: string = '';
  public ticketSelected: string = '';
  public new: boolean = false;
  public routeForm: any = {
    name: { it: '', en: '' },
    stops: [],
    enabled: true,
    ticketTypes: [],
  };
  public stops: any[] = [];
  public ticket: any = [];
  public id: string = '';
  public stopSelected: string = '';
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
      return ticket.name.it;
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
    debugger;
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
  load(id: string) {
    this.routeService.getRouteById(id).subscribe((res) => {
      this.loading = false;
      if (res && res.route) {
        this.routeForm = res.route;
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
          obj.name.it,
          obj.name.en,
          obj.stops,
          obj.ticketTypes,
          obj.id,
          obj.enabled
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
