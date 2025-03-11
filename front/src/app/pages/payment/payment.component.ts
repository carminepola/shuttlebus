import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { RouterModule } from '@angular/router';
import { BookingsService } from '../../services/bookings/bookings.service';
import { StripeService } from '../../services/stripe/stripe.service';
@Component({
  selector: 'app-payment',
  imports: [CommonModule, TranslatePipe, RouterModule],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.scss',
})
export class PaymentComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bookingService: BookingsService,
    private stripeService: StripeService
  ) {}

  public methods: string = '';
  public actions: string = '';
  public id: string = '';
  async ngOnInit(): Promise<void> {
    debugger;
    this.route.params.subscribe((params) => {
      debugger;
      this.id = params['id'];
      this.methods = params['type'];
      this.actions = params['action'];
    });
    localStorage.removeItem('ticket');

    if (this.actions == 'cancel') {
      this.stripeService.delete(this.id).subscribe((res) => {});
    }
  }
}
