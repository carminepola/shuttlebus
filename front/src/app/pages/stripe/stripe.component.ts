import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StripeService } from '../../services/stripe/stripe.service';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { finalize } from 'rxjs/operators';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-stripe',
  standalone: true,
  imports: [CommonModule, FormsModule, TitlePageComponent, LoadingComponent],
  templateUrl: './stripe.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './stripe.component.scss',
})
export class StripeComponent implements OnInit {
  loading = true;
  loadingMore = false;
  paymentIntents: any[] = [];
  hasMore = false;
  lastId: string | null = null;

  filterStatus = '';
  searchTerm = '';

  selectedPi: any = null;
  detailLoading = false;

  statusOptions = [
    { value: '', label: 'Tutti' },
    { value: 'succeeded', label: 'Succeeded' },
    { value: 'requires_payment_method', label: 'Requires Payment' },
    { value: 'requires_capture', label: 'Requires Capture' },
    { value: 'requires_action', label: 'Requires Action' },
    { value: 'processing', label: 'Processing' },
    { value: 'canceled', label: 'Canceled' },
  ];

  constructor(private stripeService: StripeService) {}

  ngOnInit(): void {
    this.loadPaymentIntents();
  }

  loadPaymentIntents(): void {
    this.loading = true;
    this.paymentIntents = [];
    this.lastId = null;
    this.stripeService
      .getPaymentIntents({ limit: 20, status: this.filterStatus || undefined })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res: any) => {
          this.paymentIntents = res.data || [];
          this.hasMore = res.has_more || false;
          this.lastId = this.paymentIntents.length > 0 ? this.paymentIntents[this.paymentIntents.length - 1].id : null;
        },
        error: (err) => console.error('Error loading payment intents', err),
      });
  }

  loadMore(): void {
    if (this.loadingMore || !this.hasMore || !this.lastId) return;
    this.loadingMore = true;
    this.stripeService
      .getPaymentIntents({ limit: 20, starting_after: this.lastId, status: this.filterStatus || undefined })
      .pipe(finalize(() => (this.loadingMore = false)))
      .subscribe({
        next: (res: any) => {
          const newData = res.data || [];
          this.paymentIntents = [...this.paymentIntents, ...newData];
          this.hasMore = res.has_more || false;
          this.lastId = newData.length > 0 ? newData[newData.length - 1].id : null;
        },
        error: (err) => console.error('Error loading more payment intents', err),
      });
  }

  onFilterChange(): void {
    this.loadPaymentIntents();
  }

  get filteredIntents(): any[] {
    if (!this.searchTerm.trim()) return this.paymentIntents;
    const term = this.searchTerm.toLowerCase();
    return this.paymentIntents.filter(
      (pi) =>
        pi.id.toLowerCase().includes(term) ||
        (pi.customerEmail || '').toLowerCase().includes(term) ||
        (pi.customerName || '').toLowerCase().includes(term) ||
        (pi.description || '').toLowerCase().includes(term) ||
        (pi.metadata?.booking_id || '').toLowerCase().includes(term) ||
        (pi.metadata?.route || '').toLowerCase().includes(term)
    );
  }

  getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      succeeded: 'sd-badge-success',
      requires_payment_method: 'sd-badge-warning',
      requires_capture: 'sd-badge-info',
      requires_action: 'sd-badge-warning',
      processing: 'sd-badge-info',
      canceled: 'sd-badge-danger',
    };
    return map[status] || 'sd-badge-secondary';
  }

  formatStatus(status: string): string {
    const map: Record<string, string> = {
      succeeded: 'Succeeded',
      requires_payment_method: 'Requires Payment',
      requires_capture: 'Requires Capture',
      requires_action: 'Requires Action',
      processing: 'Processing',
      canceled: 'Canceled',
    };
    return map[status] || status;
  }

  async openDetail(pi: any): Promise<void> {
    this.selectedPi = null;
    this.detailLoading = true;
    try {
      const res: any = await lastValueFrom(this.stripeService.getPaymentIntentDetail(pi.id));
      this.selectedPi = res.result;
    } catch (e) {
      console.error('Error loading detail', e);
    } finally {
      this.detailLoading = false;
    }
  }

  closeDetail(): void {
    this.selectedPi = null;
  }
}
