import { Component, OnInit } from '@angular/core';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { CommonModule } from '@angular/common';
import { BookingsService } from '../../services/bookings/bookings.service';
import { ActivatedRoute } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth/auth.service';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-ticket-check',
  imports: [CommonModule, LoadingComponent, TranslatePipe, RouterLink],
  templateUrl: './ticket-check.component.html',
  styleUrl: './ticket-check.component.scss',
})
export class TicketCheckComponent implements OnInit {
  public loading: boolean = true;
  public book: any;
  public notDriver: boolean = false;
  constructor(
    private bookingsService: BookingsService,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  todayDate(date: string) {
    let today = new Date().setHours(0, 0, 0, 0);
    let dateConfronto = new Date(date).setHours(0, 0, 0, 0);
    return today == dateConfronto;
  }
  getRole() {
    let user = this.authService.getDecodedToken();
    if (user) {
      return parseInt(user.role);
    }
    return 9999;
  }

  async ngOnInit(): Promise<any> {
    let id = '';

    if (this.getRole() <= 75) {
      this.route.params.subscribe((params) => {
        id = params['id'];
      });
      let ris: any = await lastValueFrom(
        this.bookingsService.readBookingById(id)
      );

      this.book = ris.bookings;
      this.loading = false;
      return true;
    }

    this.notDriver = true;
    this.loading = false;
    return false;
  }
}
