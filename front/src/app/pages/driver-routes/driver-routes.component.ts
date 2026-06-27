import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { fadeAnimation } from '../../animations/fade.animation';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { CommonModule } from '@angular/common';

import { lastValueFrom } from 'rxjs';
import { RoutesService } from '../../services/routes/routes.service';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { Router, ActivatedRoute } from '@angular/router';
import { FilterStatusPipe } from '../../pipe/filter-status.pipe';

interface DriverSchedule {
  name: string;
  departureTime: string;
  id: string;
  routeId: string;
  routeName: string;
  firstStop: string;
  lastStop: string;
  status: 'upcoming' | 'in-progress' | 'completed';
  departureMinutes: number;
}

@Component({
  selector: 'app-driver-routes',
  imports: [TitlePageComponent, LoadingComponent, CommonModule, FilterStatusPipe],
  templateUrl: './driver-routes.component.html',
  styleUrl: './driver-routes.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeAnimation],
})
export class DriverRoutesComponent {
  constructor(private routesService: RoutesService, private router: Router) {}

  public routes: DriverSchedule[] = [];
  public todayStr: string = '';
  public nowMinutes: number = 0;

  loading = true;

  goTo(path: string) {
    this.router.navigate([path]);
  }

  getScheduleIcon(status: string): string {
    switch (status) {
      case 'in-progress': return 'fa-solid fa-play-circle';
      case 'completed': return 'fa-solid fa-check-circle';
      default: return 'fa-regular fa-clock';
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'in-progress': return 'dr-status-active';
      case 'completed': return 'dr-status-done';
      default: return 'dr-status-upcoming';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'in-progress': return 'In corso';
      case 'completed': return 'Completata';
      default: return 'Prossima';
    }
  }

  private computeStatus(departureTime: string): 'upcoming' | 'in-progress' | 'completed' {
    const parts = departureTime.split(':');
    const depMinutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    const diff = depMinutes - this.nowMinutes;
    if (diff < -90) return 'completed';
    if (diff <= 30 && diff >= -90) return 'in-progress';
    return 'upcoming';
  }

  async ngOnInit() {
    this.todayStr = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    const now = new Date();
    this.nowMinutes = now.getHours() * 60 + now.getMinutes();

    let routes = await lastValueFrom(this.routesService.getRoutes());
    this.loading = false;

    if (routes.routes) {
      for (let i = 0; i < routes.routes.length; i++) {
        const currentRoute = routes.routes[i];
        if (!currentRoute.enabled) continue;
        for (let j = 0; j < currentRoute.schedules.length; j++) {
          const currentSchedule = currentRoute.schedules[j];
          if (currentSchedule.status !== 'active') continue;

          const stops = currentRoute.stops || currentSchedule.stops || [];
          const firstStop = stops.length > 0 ? stops[0].name || stops[0].stopTime : currentSchedule.departureTime;
          const lastStop = stops.length > 0 ? stops[stops.length - 1].name || stops[stops.length - 1].stopTime : '';

          const status = this.computeStatus(currentSchedule.departureTime);
          const parts = currentSchedule.departureTime.split(':');
          const depMinutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);

          this.routes.push({
            name: currentRoute.name.it,
            departureTime: currentSchedule.departureTime,
            id: currentSchedule.id,
            routeId: currentRoute.id,
            routeName: currentRoute.name.it,
            firstStop: typeof firstStop === 'string' ? firstStop : '',
            lastStop: typeof lastStop === 'string' ? lastStop : '',
            status,
            departureMinutes: depMinutes,
          });
        }
      }

      this.routes.sort((a, b) => {
        const statusOrder = { 'in-progress': 0, 'upcoming': 1, 'completed': 2 };
        const so = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
        if (so !== 0) return so;
        return a.departureMinutes - b.departureMinutes;
      });
    }
  }
}
