import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { TranslatePipe } from '../../pipe/translate.pipe';
import { RouterModule } from '@angular/router';
import { BookingsService } from '../../services/bookings/bookings.service';
import { StripeService } from '../../services/stripe/stripe.service';
import { LngService } from '../../services/lng/lng.service';
@Component({
  selector: 'app-payment',
  imports: [TranslatePipe, RouterModule],
  templateUrl: './payment.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './payment.component.scss',
})
export class PaymentComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bookingService: BookingsService,
    private stripeService: StripeService,
    public lngService: LngService,
  ) {}

  public methods: string = '';
  public actions: string = '';
  public id: string = '';
  async ngOnInit(): Promise<void> {
    this.route.params.subscribe((params) => {
      this.id = params['id'];
      this.methods = params['type'];
      this.actions = params['action'];
    });
    localStorage.removeItem('ticket');

    if (this.actions == 'cancel') {
      this.stripeService.delete(this.id).subscribe((res) => {});
    }
  }
  isCashPayment(): boolean {
    return this.methods === 'cash';
  }
}
