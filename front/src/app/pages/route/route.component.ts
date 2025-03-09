import { Component, OnInit } from '@angular/core';
import { RoutesService } from '../../services/routes/routes.service';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { Router, RouterModule } from '@angular/router';
import { FilterPipe } from '../../pipe/filter.pipe';
import { FormsModule } from '@angular/forms';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { CommonModule } from '@angular/common';
import { StopsService } from '../../services/stops/stops.service';
import { lastValueFrom } from 'rxjs';
@Component({
  selector: 'app-route',
  imports: [
    TitlePageComponent,
    RouterModule,
    FilterPipe,
    CommonModule,
    LoadingComponent,
    FormsModule,
  ],
  templateUrl: './route.component.html',
  styleUrls: ['./route.component.scss'],
})
export class RouteComponent implements OnInit {
  routes: any[] = [];
  loading: boolean = true;
  public search: string = '';
  private stops: any[] = [];
  constructor(
    private routeService: RoutesService,
    private router: Router,
    private stopsService: StopsService
  ) {}

  async ngOnInit(): Promise<void> {
    let risStops = await lastValueFrom(this.stopsService.getAllActiveStops());

    this.stops = risStops.stops;
    let r = await lastValueFrom(this.routeService.getRoutes());
    this.routes = r.routes.map((route: any) => {
      let firstStop = this.stops.find((t: any) => t.id === route.stops[0].id);
      let lastStop = this.stops.find(
        (t: any) => t.id === route.stops[route.stops.length - 1].id
      );

      return {
        nome: route.name.it,
        id: route.id,
        partenza: firstStop.name,
        arrivo: lastStop.name,
        schedulazioni: route.schedules?.length || 0,
      };
    });

    this.loading = false;
  }
  edit(id: string) {
    this.router.navigate([`admin/route/${id}`]);
  }
  schedule(id: string) {
    this.router.navigate([`admin/schedule/${id}`]);
  }
}
