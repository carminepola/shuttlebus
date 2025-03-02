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

@Component({
  selector: 'app-search-page',
  imports: [
    SearchComponent,
    TranslatePipe,
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
  ],
  templateUrl: './search-page.component.html',
  styleUrl: './search-page.component.scss',
})
export class SearchPageComponent implements OnInit {
  public routes: string[] = [];
  public stops: string[] = [];
  public ricerca = {
    partenza: '',
    arrivo: '',
    persone: 0,
    data: '',
    bagagli: 0,
  };
  public params: any;
  constructor(
    private routesService: RoutesService,
    private stopsService: StopsService,
    private bookingService: BookingsService,
    private router: Router,
    private route: ActivatedRoute
  ) {}
  async ngOnInit(): Promise<void> {
    this.route.params.subscribe((params) => {
      this.ricerca.partenza = params['partenza'];
      this.ricerca.arrivo = params['arrivo'];
      this.ricerca.persone = parseInt(params['persone']);
      this.ricerca.data = params['data'];
      this.ricerca.bagagli = parseInt(params['bagagli']);
    });
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

    this.params = risBookings;
  }
}
