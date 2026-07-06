import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { CommonModule } from '@angular/common';
import { lastValueFrom } from 'rxjs';
import { fadeAnimation } from '../../animations/fade.animation';
import { BookingsService } from '../../services/bookings/bookings.service';
import { Route, ActivatedRoute, Router } from '@angular/router';
import { TitlePageComponent } from '../../components/title-page/title-page.component';

import { LngService } from '../../services/lng/lng.service';

@Component({
  selector: 'app-ticket-for-routes',
  imports: [
    LoadingComponent,
    CommonModule,
    TitlePageComponent,
  ],
  templateUrl: './ticket-for-routes.component.html',
  styleUrl: './ticket-for-routes.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeAnimation],
})
export class TicketForRoutesComponent {
  constructor(
    private bookingsService: BookingsService,
    private route: ActivatedRoute,
    private router: Router,
    private lngService: LngService,
  ) {}
  loading = true;
  bookings: any = [];

  async ngOnInit(): Promise<void> {
    let id = '';
    this.route.params.subscribe((params) => {
      id = params['id'];
    });
    let bookings: any = await lastValueFrom(
      this.bookingsService.currentDayBookingsFromScheduleId(id)
    );
    if (bookings.bookings) {
      this.bookings = bookings.bookings;
    }
    this.loading = false;
  }

  goTo(path: string) {
    this.router.navigate(this.lngService.langPathArray(path));
  }
}
