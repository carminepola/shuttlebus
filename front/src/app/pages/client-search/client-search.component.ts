import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { BookingsService } from '../../services/bookings/bookings.service';
import { UserService } from '../../services/user/user.service';
import { fadeAnimation } from '../../animations/fade.animation';
import { lastValueFrom } from 'rxjs';
import { finalize } from 'rxjs/operators';

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
export class ClientSearchComponent implements OnInit {
  ticketNumber: string = '';
  loading: boolean = false;
  error: string = '';
  clientData: any = null;
  bookingData: any = null;

  constructor(
    private bookingsService: BookingsService,
    private userService: UserService,
  ) {}

  ngOnInit(): void {}

  async searchClient(): Promise<void> {
    if (!this.ticketNumber.trim()) {
      this.error = 'Inserisci un numero di ticket/prenotazione';
      return;
    }

    this.loading = true;
    this.error = '';
    this.clientData = null;
    this.bookingData = null;

    try {
      const bookingResult: any = await lastValueFrom(
        this.bookingsService.readBookingById(this.ticketNumber.trim())
      );

      if (bookingResult.booking) {
        this.bookingData = bookingResult.booking;
        
        if (bookingResult.booking.userId) {
          try {
            const userResult: any = await lastValueFrom(
              this.userService.getUserById(bookingResult.booking.userId)
            );
            this.clientData = userResult.user || userResult;
          } catch (userError) {
            console.error('Error loading user details:', userError);
            this.error = 'Prenotazione trovata ma non è stato possibile caricare i dettagli del cliente';
          }
        } else {
          this.error = 'Prenotazione trovata ma non associata a nessun cliente';
        }
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
    this.bookingData = null;
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
      default:
        return status;
    }
  }
}