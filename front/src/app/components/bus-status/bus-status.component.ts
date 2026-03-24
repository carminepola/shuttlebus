import { Component, OnInit, OnDestroy } from '@angular/core';
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
  } | null;
  nextStop: {
    id: string;
    name: string;
    scheduledTime: string;
  } | null;
  status: 'on_time' | 'late' | 'early' | 'no_schedule' | 'no_stop';
  delay: number | null;
  currentLat: number;
  currentLng: number;
}

@Component({
  selector: 'app-bus-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bus-status.component.html',
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
    this.intervalId = setInterval(() => this.loadBusStatus(), 30000); // Aggiorna ogni 30 secondi
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
      case 'on_time':
        return 'status-on-time';
      case 'late':
        return 'status-late';
      case 'early':
        return 'status-early';
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
      case 'on_time':
        return 'In orario';
      case 'late':
        return 'In ritardo';
      case 'early':
        return 'In anticipo';
      case 'no_schedule':
        return 'Nessuna corsa programmata';
      case 'no_stop':
        return 'Nessuna fermata trovata';
      default:
        return status;
    }
  }

  getDelayText(delay: number | null): string {
    if (delay === null) return '-';
    if (delay === 0) return '0 min';
    const sign = delay > 0 ? '+' : '';
    return `${sign}${delay} min`;
  }

  getDelayAlertClass(status: string): string {
    switch (status) {
      case 'on_time':
        return 'alert-success';
      case 'late':
        return 'alert-danger';
      case 'early':
        return 'alert-info';
      default:
        return 'alert-secondary';
    }
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
