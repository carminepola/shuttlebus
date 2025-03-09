import { Component, OnInit } from '@angular/core';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { TranslateNamePipe } from '../../pipe/translateName.pipe';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { CommonModule } from '@angular/common';
import { BookingsService } from '../../services/bookings/bookings.service';
import { lastValueFrom } from 'rxjs';
@Component({
  selector: 'app-my-tickets',
  imports: [
    LoadingComponent,
    TranslatePipe,
    TranslateNamePipe,
    TitlePageComponent,
    CommonModule,
  ],
  templateUrl: './my-tickets.component.html',
  styleUrl: './my-tickets.component.scss',
})
export class MyTicketsComponent implements OnInit {
  bookings: any = [];
  constructor(private bookingsService: BookingsService) {}
  loading = true;
  async ngOnInit(): Promise<void> {
    this.load();
  }
  async load() {
    let bookings: any = await lastValueFrom(
      this.bookingsService.getBookingForUser()
    );
    console.log(bookings);

    this.bookings = bookings['booking'] || [];
    this.loading = false;
  }
}
