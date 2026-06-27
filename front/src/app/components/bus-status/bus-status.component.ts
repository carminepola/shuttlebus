import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MomapService } from '../../services/momap.service';
import { lastValueFrom } from 'rxjs';

interface BusStatus {
  busId: string;
  plate: string | null;
  name: string | null;
  line: {
    it: string;
    en: string;
  } | null;
  currentStop: {
    id: string;
    name: string;
    scheduledTime: string;
    distance: number;
    arrivalTime: string | null;
    departureTime: string | null;
  } | null;
  nextStop: {
    id: string;
    name: string;
    scheduledTime: string;
  } | null;
  status: 'on_spot' | 'en_route' | 'no_schedule' | 'no_stop';
  estimatedArrival: string | null;
  currentLat: number;
  currentLng: number;
}

@Component({
  selector: 'app-bus-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bus-status.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './bus-status.component.scss',
})
export class BusStatusComponent implements OnInit, OnDestroy {
  busStatusList: BusStatus[] = [];
  loading = true;
  error: string | null = null;
  private intervalId: any;

  constructor(private momapService: MomapService) {}

  async ngOnInit(): Promise<void> {
    await this.loadBusStatus();
    this.intervalId = setInterval(() => this.loadBusStatus(), 30000);
  }

  async loadBusStatus(): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      const response = await lastValueFrom(this.momapService.getBusStatus());
      this.busStatusList = response.busStatus || [];
    } catch (err) {
      console.error('Errore nel caricamento dello stato degli autobus', err);
      this.error =
        'Impossibile caricare lo stato degli autobus. Riprova più tardi.';
    } finally {
      this.loading = false;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'on_spot':
        return 'status-on-spot';
      case 'en_route':
        return 'status-en-route';
      case 'no_schedule':
        return 'status-no-schedule';
      case 'no_stop':
        return 'status-no-stop';
      default:
        return '';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'on_spot':
        return 'Sul posto';
      case 'en_route':
        return 'In viaggio';
      case 'no_schedule':
        return 'Nessuna corsa programmata';
      case 'no_stop':
        return 'Nessuna fermata trovata';
      default:
        return status;
    }
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
