import { Component, OnInit, AfterViewInit, Input } from '@angular/core';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { lastValueFrom } from 'rxjs';
import { StopsService } from '../../services/stops/stops.service';
import { RoutesService } from '../../services/routes/routes.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, NgForm, ReactiveFormsModule } from '@angular/forms';

declare var bootstrap: any;
@Component({
  selector: 'app-search',
  imports: [TranslatePipe, CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
})
export class SearchComponent implements OnInit, AfterViewInit {
  @Input() ricerca?: {
    partenza?: string;
    arrivo?: string;
    persone?: number;
    data?: string;
    bagagli?: number;
  };

  public today = new Date().toISOString().split('T')[0];
  public routes: string[] = [];
  public stops: string[] = [];
  public allStop: any = [];
  public selectStart: any = [];
  public selectEnd: any = [];

  constructor(
    private routesService: RoutesService,
    private stopsService: StopsService,
    private router: Router
  ) {}

  ngAfterViewInit() {
    const tooltipTriggerList = document.querySelectorAll(
      '[data-bs-toggle="tooltip"]'
    );
    const tooltipList = [...tooltipTriggerList].map(
      (tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl)
    );
  }

  async ngOnInit(): Promise<void> {
    debugger;
    if (!this.ricerca) {
      this.ricerca = {
        partenza: '',
        arrivo: '',
        persone: 1,
        data: new Date().toISOString().split('T')[0],
        bagagli: 0,
      };
    }

    let risRoutes = await lastValueFrom(this.routesService.getRoutes());
    let risStops = await lastValueFrom(this.stopsService.getAllActiveStops());

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
    debugger;
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
  onSubmit(f: NgForm) {
    if (!f.valid) {
      return;
    }
    this.router.navigate([
      '/search',
      this.ricerca?.partenza,
      this.ricerca?.arrivo,
      this.ricerca?.persone,
      this.ricerca?.data,
      this.ricerca?.bagagli,
    ]);
  }
}
