import { Component, OnInit } from '@angular/core';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { CommonModule } from '@angular/common';
import { BookingsService } from '../../services/bookings/bookings.service';
import { ActivatedRoute } from '@angular/router';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-ticket-check',
  imports: [CommonModule, LoadingComponent],
  templateUrl: './ticket-check.component.html',
  styleUrl: './ticket-check.component.scss',
})
export class TicketCheckComponent implements OnInit {
  public loading: boolean = true;
  public book: any;
  constructor(
    private bookingsService: BookingsService,
    private route: ActivatedRoute
  ) {}

  todayDate(date: string) {
    let today = new Date().setHours(0, 0, 0, 0);
    let dateConfronto = new Date(date).setHours(0, 0, 0, 0);
    return today == dateConfronto;
  }
  async ngOnInit(): Promise<any> {
    let id = '';
    this.route.params.subscribe((params) => {
      id = params['id'];
    });
    let ris: any = await lastValueFrom(
      this.bookingsService.readBookingById(id)
    );
    console.log(ris);
    this.book = ris.bookings;
    this.loading = false;
  }
}
