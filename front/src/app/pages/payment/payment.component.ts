import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { TranslatePipe } from '../../pipe/translate.pipe';
import { RouterModule } from '@angular/router';
import { BookingsService } from '../../services/bookings/bookings.service';
import { StripeService } from '../../services/stripe/stripe.service';
import { LngService } from '../../services/lng/lng.service';
import { lastValueFrom } from 'rxjs';
@Component({
  selector: 'app-payment',
  imports: [TranslatePipe, RouterModule],
  templateUrl: './payment.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './payment.component.scss',
})
export class PaymentComponent implements OnInit, OnDestroy {
  // Stato verifica pagamento: la conferma arriva SOLO dal server (webhook processato)
  public verifyState: 'checking' | 'confirmed' | 'pending' = 'checking';
  private retryInterval: any = null;
  private retryCount = 0;
  private static readonly MAX_AUTO_RETRIES = 12;
  private static readonly RETRY_DELAY_MS = 5000;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bookingService: BookingsService,
    private stripeService: StripeService,
    private lng: LngService
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
    // Success stripe: NON confermare subito, verifica l'esito reale server-side
    if (this.actions == 'success' && !this.isCashPayment()) {
      this.checkPayment();
    }
  }
  ngOnDestroy(): void {
    this.stopRetry();
  }

  async checkPayment(): Promise<void> {
    this.verifyState = 'checking';
    try {
      // GET /booking/ticket/:id -> 200 solo se il pagamento risulta processato (paid), 404 altrimenti
      await lastValueFrom(this.bookingService.getTicketData(this.id));
      this.verifyState = 'confirmed';
      this.stopRetry();
    } catch (e) {
      this.verifyState = 'pending';
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    if (this.retryInterval) {
      return;
    }
    this.retryCount = 0;
    this.retryInterval = setInterval(async () => {
      this.retryCount++;
      if (this.retryCount >= PaymentComponent.MAX_AUTO_RETRIES) {
        this.stopRetry();
        return;
      }
      try {
        await lastValueFrom(this.bookingService.getTicketData(this.id));
        this.verifyState = 'confirmed';
        this.stopRetry();
      } catch (e) {
        // resta in attesa del webhook
      }
    }, PaymentComponent.RETRY_DELAY_MS);
  }

  private stopRetry(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }

  isCashPayment(): boolean {
    return this.methods === 'cash';
  }

  private label(key: string, fallback: string): string {
    const t = this.lng.traslate(key);
    return t === key ? fallback : t;
  }

  inVerificationTitle(): string {
    return this.label('str_pagamento_in_verifica', 'Pagamento in verifica');
  }
  inVerificationDesc(): string {
    return this.label(
      'str_pagamento_in_verifica_desc',
      'Abbiamo ricevuto il tuo pagamento e stiamo attendendo la conferma.'
    );
  }
  inVerificationDesc2(): string {
    return this.label(
      'str_pagamento_in_verifica_desc2',
      'Puoi riprovare la verifica o controllare lo stato nella sezione dei tuoi biglietti.'
    );
  }
  retryLabel(): string {
    return this.label('str_riprova', 'Riprova');
  }
}
