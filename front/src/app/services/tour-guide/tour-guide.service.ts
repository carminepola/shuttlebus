import { Injectable, NgZone } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { driver, Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { LngService } from '../lng/lng.service';

@Injectable({
  providedIn: 'root',
})
export class TourGuideService {
  private readonly STORAGE_KEY = 'shuttlebus_ticket_tour_done';
  private driverObj: Driver | null = null;

  constructor(
    private router: Router,
    private ngZone: NgZone,
    private lngService: LngService,
  ) {}

  shouldShowTour(): boolean {
    return !localStorage.getItem(this.STORAGE_KEY);
  }

  startTicketTour(): void {
    if (!this.shouldShowTour()) return;

    const gotIt = this.lngService.traslate('str_tour_got_it');

    this.driverObj = driver({
      showProgress: false,
      animate: true,
      allowClose: false,
      showButtons: ['next'],
      disableActiveInteraction: false,
      nextBtnText: gotIt,
      doneBtnText: gotIt,
      stagePadding: 6,
      stageRadius: 12,
      popoverClass: 'shuttlebus-tour-popover',
      steps: [
        {
          element: '#tour-account-icon',
          popover: {
            title: this.lngService.traslate('str_tour_account_title'),
            description: this.lngService.traslate('str_tour_account_desc'),
            side: 'top',
            align: 'center',
          },
        },
      ],
      onDestroyStarted: () => {
        localStorage.setItem(this.STORAGE_KEY, 'true');
        this.driverObj?.destroy();
      },
    });

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd && this.driverObj?.isActive()) {
        this.ngZone.runOutsideAngular(() => {
          setTimeout(() => {
            this.driverObj?.refresh();
          }, 300);
        });
      }
    });

    setTimeout(() => {
      this.driverObj?.drive();
    }, 600);
  }

  resetTour(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
