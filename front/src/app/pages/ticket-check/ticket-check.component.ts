import { Component, OnInit } from '@angular/core';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { CommonModule } from '@angular/common';
import { BookingsService } from '../../services/bookings/bookings.service';
import { ActivatedRoute } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth/auth.service';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { fadeAnimation } from '../../animations/fade.animation';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
@Component({
  selector: 'app-ticket-check',
  imports: [CommonModule, LoadingComponent, TranslatePipe, RouterLink, FormsModule, TitlePageComponent],
  templateUrl: './ticket-check.component.html',
  styleUrl: './ticket-check.component.scss',
  animations: [fadeAnimation],
})
export class TicketCheckComponent implements OnInit {
  public loading: boolean = true;
  public book: any;
  public notDriver: boolean = false;
  public alreadyScanned: boolean = false;
  public scannedBy: any = null;
  public notFound: boolean = false;
  public wrongDate: boolean = false;
  public wrongTime: boolean = false;
  public departureTime: string = '';
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

  formatScanDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async ngOnInit(): Promise<any> {
    let id = '';

    if (this.getRole() <= 75) {
      this.route.params.subscribe((params) => {
        id = params['id'];
      });
      let ris: any = await lastValueFrom(
        this.bookingsService.scanTicket(id)
      );

      if (!ris.found) {
        this.notFound = true;
      } else if (ris.wrongDate) {
        this.wrongDate = true;
        this.book = ris.booking;
      } else if (ris.wrongTime) {
        this.wrongTime = true;
        this.departureTime = ris.departureTime;
        this.book = ris.booking;
      } else {
        this.book = ris.booking;
        this.alreadyScanned = ris.alreadyScanned;
        this.scannedBy = ris.scannedBy;
      }
      this.loading = false;
      return true;
    }

    this.notDriver = true;
    this.loading = false;
    return false;
  }
}
