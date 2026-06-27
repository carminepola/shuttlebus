import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { FormsModule, ReactiveFormsModule, NgForm } from '@angular/forms';

import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { ActivatedRoute, Router } from '@angular/router';
import { RoutesService } from '../../services/routes/routes.service';

import { fadeAnimation } from '../../animations/fade.animation';
@Component({
  selector: 'app-schedule-list',
  imports: [
    TitlePageComponent,
    FormsModule,
    LoadingComponent,
    ReactiveFormsModule
],
  animations: [fadeAnimation],
  templateUrl: './schedule-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './schedule-list.component.scss',
})
export class ScheduleListComponent implements OnInit {
  public loading: boolean = true;
  routes: any[] = [];
  private idRoute: string = '';
  constructor(
    private route: ActivatedRoute,
    private router: Router,

    private cdr: ChangeDetectorRef,
    private routeService: RoutesService
  ) {}
  async ngOnInit(): Promise<void> {
    this.route.params.subscribe((params) => {
      this.idRoute = params['idRoute'];
    });
    let r = await this.routeService.getRouteById(this.idRoute).toPromise();
    this.loading = false;
    if (r.route) {
      this.routes = r.route.schedules.map((s: any) => {
        return {
          id: s.id,
          start: s.stops[0].stopTime,
          end: s.stops[s.stops.length - 1].stopTime,
          name: r.route.name.it,
          active: s.status === 'active',
        };
      });
    }
  }
  editRoute(id: string) {
    this.router.navigate([`admin/schedule/${this.idRoute}/${id}`]);
  }
  newRoute() {
    this.router.navigate([`admin/schedule/${this.idRoute}`]);
  }
}
