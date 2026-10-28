import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { SavedCard, StripeService } from '../../services/stripe/stripe.service';
import { LngService } from '../../services/lng/lng.service';

const BRAND_ICONS: Record<string, string> = {
  visa: 'fa-brands fa-cc-visa',
  mastercard: 'fa-brands fa-cc-mastercard',
  amex: 'fa-brands fa-cc-amex',
  american_express: 'fa-brands fa-cc-amex',
  discover: 'fa-brands fa-cc-discover',
  diners: 'fa-brands fa-cc-diners-club',
  jcb: 'fa-brands fa-cc-jcb',
};

const BRAND_NAMES: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  american_express: 'American Express',
  discover: 'Discover',
  diners: 'Diners Club',
  jcb: 'JCB',
  cartes_bancaires: 'Cartes Bancaires',
  unionpay: 'UnionPay',
};

/**
 * Carte salvate al checkout Stripe: l'utente le ritrova al pagamento successivo
 * e da qui puo' rimuoverle. Si salvano spuntando la casella nella pagina di pagamento.
 */
@Component({
  selector: 'app-saved-cards',
  templateUrl: './saved-cards.component.html',
  styleUrl: './saved-cards.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class SavedCardsComponent implements OnInit {
  cards: SavedCard[] = [];
  loading = true;
  busy = false;
  error = '';
  success = '';
  confirmRemoveId: string | null = null;

  constructor(
    private stripeService: StripeService,
    private lng: LngService,
  ) {}

  ngOnInit(): void {
    this.loadCards();
  }

  t(key: string, fallback: string): string {
    return this.lng.traslateOr(key, fallback);
  }

  loadCards(): void {
    this.stripeService.getSavedCards().subscribe({
      next: (cards) => {
        this.cards = cards;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = this.t('str_cards_load_error', 'Impossibile caricare le carte salvate.');
      },
    });
  }

  brandIcon(brand: string): string {
    return BRAND_ICONS[brand] || 'fa-solid fa-credit-card';
  }

  brandName(brand: string): string {
    return BRAND_NAMES[brand] || this.t('str_card', 'Carta');
  }

  isExpired(card: SavedCard): boolean {
    const now = new Date();
    return card.expYear < now.getFullYear() || (card.expYear === now.getFullYear() && card.expMonth < now.getMonth() + 1);
  }

  async removeCard(id: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    this.success = '';
    try {
      await lastValueFrom(this.stripeService.removeSavedCard(id));
      this.cards = this.cards.filter((c) => c.id !== id);
      this.confirmRemoveId = null;
      this.success = this.t('str_card_removed', 'Carta rimossa');
    } catch (e: any) {
      this.error = e?.error?.message || this.t('str_generic_error', 'Si è verificato un errore. Riprova.');
    } finally {
      this.busy = false;
    }
  }
}
