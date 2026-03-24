import { Component, OnInit } from '@angular/core';
import { fadeAnimation } from '../../animations/fade.animation';
import { LoadingComponent } from '../../components/loading/loading/loading.component';

import { lastValueFrom } from 'rxjs';
import { RoutesService } from '../../services/routes/routes.service';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-driver-routes',
  imports: [TitlePageComponent],
  templateUrl: './driver-routes.component.html',
  styleUrl: './driver-routes.component.scss',
  animations: [fadeAnimation],
})
export class DriverRoutesComponent {
  constructor(private routesService: RoutesService, private router: Router) {}

  public routes: any[] = [];

  loading = true;

  goTo(path: string) {
    this.router.navigate([path]);
  }
  async ngOnInit() {
    let routes = await lastValueFrom(this.routesService.getRoutes());
    this.loading = false;
    if (routes.routes) {
      for (let i = 0; i < routes.routes.length; i++) {
        let currentRoutes = routes.routes[i];
        for (let j = 0; j < currentRoutes.schedules.length; j++) {
          let currentSchedule = currentRoutes.schedules[j];

          let newItem = {
            name:
              currentRoutes.name.it +
              ' (' +
              currentSchedule.departureTime +
              ')',
            id: currentSchedule.id,
          };
          this.routes.push(newItem);
        }
      }
    }
  }
}
