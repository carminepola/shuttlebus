import { Component } from '@angular/core';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { Route } from '@angular/router';
@Component({
  selector: 'app-reservation',
  imports: [TitlePageComponent],
  templateUrl: './reservation.component.html',
  styleUrl: './reservation.component.scss',
})
export class ReservationComponent {}
