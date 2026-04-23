import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { LngService } from '../lng/lng.service';

@Injectable({
  providedIn: 'root',
})
export class TourGuideService {
  private readonly STORAGE_KEY = 'shuttlebus_ticket_tour_done';
  private showTour$ = new BehaviorSubject<boolean>(false);

  constructor(private lngService: LngService) {}

  shouldShowTour(): boolean {
    return !localStorage.getItem(this.STORAGE_KEY);
  }

  getTourVisible() {
    return this.showTour$.asObservable();
  }

  startTicketTour(): void {
    if (!this.shouldShowTour()) return;
    setTimeout(() => {
      this.showTour$.next(true);
    }, 400);
  }

  dismissTour(): void {
    localStorage.setItem(this.STORAGE_KEY, 'true');
    this.showTour$.next(false);
  }

  resetTour(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
