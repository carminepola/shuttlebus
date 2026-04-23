import { Injectable } from '@angular/core';
import { BookingsService } from '../bookings/bookings.service';
import { AuthService } from '../auth/auth.service';
import { LngService } from '../lng/lng.service';
import { lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
export class PendingBookingService {
  constructor(
    private bookingsService: BookingsService,
    private authService: AuthService,
    private lngService: LngService,
  ) {}

  async hasPendingBooking(): Promise<any> {
    if (!this.authService.isLoggedIn()) {
      return null;
    }
    try {
      const res = await lastValueFrom(
        this.bookingsService.getBookingFromUser(),
      );
      const bookings = res['booking'] || [];
      const pending = bookings.find((b: any) => b.status === 'pending');
      return pending || null;
    } catch {
      return null;
    }
  }

  async showPendingModal(): Promise<boolean> {
    const result = await Swal.fire({
      title: this.lngService.traslate('str_pagamento_in_corso_title'),
      text: this.lngService.traslate('str_pagamento_in_corso_text'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: this.lngService.traslate(
        'str_pagamento_in_corso_continua',
      ),
      cancelButtonText: this.lngService.traslate(
        'str_pagamento_in_corso_annulla',
      ),
      allowOutsideClick: false,
      position: 'top',
      showClass: {
        popup: `animate__animated animate__slideInDown animate__faster`,
      },
      hideClass: {
        popup: `animate__animated animate__slideOutUp animate__faster`,
      },
      customClass: {
        confirmButton: 'btn btn-primary btn-lg',
        cancelButton: 'btn btn-outline-secondary btn-lg',
        popup: 'rounded-4 glass',
      },
    });
    return result.isConfirmed;
  }

  async cancelPendingBooking(pendingBooking: any): Promise<void> {
    try {
      await lastValueFrom(
        this.bookingsService.deleteBooking(
          pendingBooking.numberOfTickets.toString(),
        ),
      );
    } catch (e) {
      console.error('Error cancelling pending booking', e);
    }
  }
}
