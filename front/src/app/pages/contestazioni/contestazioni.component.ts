import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { fadeAnimation } from '../../animations/fade.animation';
import { FilterPipe } from '../../pipe/filter.pipe';
import { StripeService } from '../../services/stripe/stripe.service';
import { lastValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

interface DisputeItem {
  id: string;
  amount: string;
  currency: string;
  status: string;
  reason: string;
  created: string;
  chargeId: string;
  paymentIntentId: string;
  evidenceDetails: {
    dueBy: string | null;
    hasEvidence: boolean;
    submissionCount: number;
  } | null;
}

@Component({
  selector: 'app-contestazioni',
  imports: [
    TitlePageComponent,
    LoadingComponent,
    CommonModule,
    FilterPipe,
    FormsModule,
  ],
  animations: [fadeAnimation],
  templateUrl: './contestazioni.component.html',
  styleUrl: './contestazioni.component.scss',
})
export class ContestazioniComponent implements OnInit {
  public loading = true;
  public disputes: DisputeItem[] = [];
  public search = '';
  public filterStatus = 'all';

  constructor(public stripeService: StripeService) {}

  async ngOnInit(): Promise<void> {
    this.loading = true;
    await this.loadDisputes();
  }

  async loadDisputes() {
    const res: any = await lastValueFrom(this.stripeService.getDisputes());
    this.disputes = res.result || [];
    this.loading = false;
  }

  getDisputeStatusLabel(status: string): string {
    const map: Record<string, string> = {
      warning_needs_response: 'Richiede risposta',
      warning_under_review: 'In revisione',
      needs_response: 'Richiede risposta',
      under_review: 'In revisione',
      charge_refunded: 'Rimborsato',
      lost: 'Persa',
      won: 'Vinta',
      closed: 'Chiusa',
    };
    return map[status] || status;
  }

  getDisputeStatusClass(status: string): string {
    const map: Record<string, string> = {
      warning_needs_response: 'text-bg-danger',
      needs_response: 'text-bg-danger',
      warning_under_review: 'text-bg-warning',
      under_review: 'text-bg-warning',
      charge_refunded: 'text-bg-info',
      lost: 'text-bg-secondary',
      won: 'text-bg-success',
      closed: 'text-bg-secondary',
    };
    return map[status] || 'text-bg-secondary';
  }

  getDisputeReasonLabel(reason: string): string {
    const map: Record<string, string> = {
      duplicate: 'Duplicato',
      fraudulent: 'Frode',
      subscription_canceled: 'Abbonamento cancellato',
      product_unacceptable: 'Prodotto inaccettabile',
      product_not_received: 'Prodotto non ricevuto',
      unrecognized: 'Non riconosciuto',
      credit_not_processed: 'Credito non elaborato',
      general: 'Generale',
      bank_cannot_process: 'Banca: non elaborabile',
      check_returned: 'Assegno restituito',
      customer_initiated: 'Avviata dal cliente',
      debit_not_authorized: 'Addebito non autorizzato',
      insufficient_funds: 'Fondi insufficienti',
      incorrect_account_details: 'Dettagli conto errati',
      late_presentament: 'Presentazione tardiva',
    };
    return map[reason] || reason;
  }

  isNeedsResponse(status: string): boolean {
    return status === 'needs_response' || status === 'warning_needs_response';
  }

  get filteredDisputes(): DisputeItem[] {
    if (this.filterStatus === 'all') return this.disputes;
    return this.disputes.filter((d) => d.status === this.filterStatus);
  }

  get pendingCount(): number {
    return this.disputes.filter((d) => this.isNeedsResponse(d.status)).length;
  }

  closeDispute(disputeId: string) {
    Swal.fire({
      title: 'Chiudere la contestazione?',
      text: 'Accettando la contestazione, l\'importo verrà rimborsato al cliente.',
      icon: 'warning',
      showDenyButton: true,
      position: 'top',
      showClass: {
        popup: 'animate__animated animate__slideInDown animate__faster',
      },
      hideClass: {
        popup: 'animate__animated animate__slideOutUp animate__faster',
      },
      customClass: {
        confirmButton: 'btn btn-primary btn-lg mr-2',
        denyButton: 'btn btn-danger btn-lg',
        popup: 'rounded-4 glass',
      },
      showCancelButton: false,
      confirmButtonText: 'Accetta e chiudi',
      denyButtonText: 'Annulla',
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.loading = true;
        this.stripeService.closeDispute(disputeId).subscribe({
          next: () => {
            this.loadDisputes();
          },
          error: () => {
            this.loading = false;
            Swal.fire({
              icon: 'error',
              title: 'Errore',
              text: 'Impossibile chiudere la contestazione',
              position: 'top',
              customClass: { popup: 'rounded-4 glass' },
            });
          },
        });
      }
    });
  }
}
