import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { BookingsService } from '../../services/bookings/bookings.service';
import { fadeAnimation } from '../../animations/fade.animation';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-client-search',
  imports: [
    TitlePageComponent,
    LoadingComponent,
    FormsModule,
    CommonModule,
  ],
  templateUrl: './client-search.component.html',
  styleUrl: './client-search.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeAnimation],
})
export class ClientSearchComponent {
  ticketNumber: string = '';
  loading: boolean = false;
  error: string = '';
  clientData: any = null;
  searchedTicketId: string = '';
  allBookings: any[] = [];

  constructor(
    private bookingsService: BookingsService,
  ) {}

  async searchClient(): Promise<void> {
    if (!this.ticketNumber.trim()) {
      this.error = 'Inserisci un numero di ticket/prenotazione';
      return;
    }

    this.loading = true;
    this.error = '';
    this.clientData = null;
    this.searchedTicketId = '';
    this.allBookings = [];

    try {
      const result: any = await lastValueFrom(
        this.bookingsService.readBookingById(this.ticketNumber.trim())
      );

      const booking = result?.bookings;

      if (booking && booking.user) {
        this.clientData = booking.user;
        this.searchedTicketId = booking.numberOfTickets;

        if (booking.userId) {
          const userBookings: any = await lastValueFrom(
            this.bookingsService.getBookingsByUserId(booking.userId)
          );
          this.allBookings = (userBookings?.booking || []).slice().sort(
            (a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0)
          );
        } else {
          this.allBookings = [booking];
        }
      } else if (booking) {
        this.searchedTicketId = booking.numberOfTickets;
        this.allBookings = [booking];
        this.error = 'Prenotazione trovata ma non associata a nessun cliente';
      } else {
        this.error = 'Nessuna prenotazione trovata con questo numero';
      }
    } catch (err: any) {
      console.error('Error searching booking:', err);
      this.error = err?.error?.message || 'Errore durante la ricerca della prenotazione';
    } finally {
      this.loading = false;
    }
  }

  onEnterKey(event: Event): void {
    if (event instanceof KeyboardEvent && event.key === 'Enter') {
      this.searchClient();
    }
  }

  resetSearch(): void {
    this.ticketNumber = '';
    this.clientData = null;
    this.searchedTicketId = '';
    this.allBookings = [];
    this.error = '';
  }

  getBookingStatusClass(status: string): string {
    switch (status) {
      case 'confirmed':
        return 'status-confirmed';
      case 'pending':
        return 'status-pending';
      case 'cancelled':
        return 'status-cancelled';
      case 'refunded':
        return 'status-refunded';
      case 'deleted':
        return 'status-deleted';
      case 'expired':
        return 'status-expired';
      default:
        return 'status-default';
    }
  }

  getBookingStatusLabel(status: string): string {
    switch (status) {
      case 'confirmed':
        return 'Confermata';
      case 'pending':
        return 'In attesa';
      case 'cancelled':
        return 'Cancellata';
      case 'refunded':
        return 'Rimborsata';
      case 'deleted':
        return 'Eliminata';
      case 'expired':
        return 'Scaduta';
      default:
        return status;
    }
  }
}