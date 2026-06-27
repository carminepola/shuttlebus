import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { UserService } from '../../services/user/user.service';
import { BookingsService } from '../../services/bookings/bookings.service';
import { StripeService } from '../../services/stripe/stripe.service';
import { fadeAnimation, slideAnimation } from '../../animations/fade.animation';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { TranslateNamePipe } from '../../pipe/translateName.pipe';
import { lastValueFrom } from 'rxjs';
import { ConfirmModalService } from '../../services/confirm-modal/confirm-modal.service';
import Swal from 'sweetalert2';

const ROLES = [
  { value: 50, label: 'ADMIN' },
  { value: 75, label: 'DRIVER' },
  { value: 100, label: 'USER' },
  { value: 9999, label: 'NO_PERMISSION' },
];

@Component({
  selector: 'app-clients',
  imports: [
    TitlePageComponent,
    RouterModule,
    LoadingComponent,
    FormsModule,
    CommonModule,
    TranslateNamePipe,
  ],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeAnimation, slideAnimation],
})
export class ClientsComponent implements OnInit, AfterViewInit {
  searchTerm: string = '';
  loading: boolean = false;
  loadingMore: boolean = false;
  clients: any[] = [];
  currentPage = 1;
  itemsPerPage = 25;
  hasMore = true;
  private intersectionObserver!: IntersectionObserver;

  roles = ROLES;

  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  formSaving = false;
  formData = { name: '', email: '', password: '', phone: '' };
  formError = '';
  editClientId = '';

  selectedClient: any = null;
  clientBookings: any[] = [];
  clientBookingsLoading = false;
  roleSaving = false;
  bookingActionLoading: string | null = null;
  clientActivity: { action: string; booking: string; time: Date; status: 'success' | 'error'; message?: string }[] = [];
  stripeTransactions: any = null;
  stripeTransactionsLoading = false;
  activeTab: 'bookings' | 'stripe' = 'bookings';

  constructor(
    private router: Router,
    private userService: UserService,
    private bookingsService: BookingsService,
    private stripeService: StripeService,
    private confirmModalService: ConfirmModalService,
  ) {}

  ngOnInit(): void {
    this.loadClients();
  }

  ngAfterViewInit(): void {
    this.setupInfiniteScroll();
  }

  ngOnDestroy(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }

  setupInfiniteScroll(): void {
    const options = {
      root: null,
      rootMargin: '300px',
      threshold: 0.01,
    };

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (
          entry.isIntersecting &&
          !this.loading &&
          !this.loadingMore &&
          this.hasMore
        ) {
          this.loadMoreClients();
        }
      });
    }, options);

    setTimeout(() => {
      this.observeSentinel();
    }, 100);
  }

  observeSentinel(): void {
    const sentinel = document.getElementById('infinite-scroll-sentinel');
    if (sentinel) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver.observe(sentinel);
    }
  }

  loadClients(): void {
    this.loading = true;
    this.clients = [];
    this.currentPage = 1;
    this.hasMore = true;

    this.userService
      .getClients(this.currentPage, this.itemsPerPage)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response: any) => {
          this.clients = response.users || [];
          this.hasMore = response.users?.length === this.itemsPerPage;
          setTimeout(() => this.observeSentinel(), 100);
        },
        error: (error: any) => {
          console.error('Error loading clients:', error);
        },
      });
  }

  loadMoreClients(): void {
    if (this.loadingMore || !this.hasMore) return;

    this.loadingMore = true;
    this.currentPage++;

    this.userService
      .getClients(this.currentPage, this.itemsPerPage)
      .pipe(finalize(() => (this.loadingMore = false)))
      .subscribe({
        next: (response: any) => {
          const newClients = response.users || [];
          this.clients = [...this.clients, ...newClients];
          this.hasMore = newClients.length === this.itemsPerPage;
          setTimeout(() => this.observeSentinel(), 100);
        },
        error: (error: any) => {
          console.error('Error loading more clients:', error);
          this.currentPage--;
        },
      });
  }

  onSearch(): void {
    if (this.searchTerm.trim() === '') {
      this.loadClients();
      return;
    }

    this.loading = true;
    this.clients = [];
    this.currentPage = 1;
    this.hasMore = true;

    this.userService
      .searchClients(this.searchTerm, this.currentPage, this.itemsPerPage)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response: any) => {
          this.clients = response.users || [];
          this.hasMore = response.users?.length === this.itemsPerPage;
          setTimeout(() => this.observeSentinel(), 100);
        },
        error: (error: any) => {
          console.error('Error searching clients:', error);
        },
      });
  }

  onSearchTermChange(): void {
    this.onSearch();
  }

  openCreateForm(): void {
    this.formMode = 'create';
    this.formData = { name: '', email: '', password: '', phone: '' };
    this.formError = '';
    this.showForm = true;
  }

  openEditForm(client: any): void {
    this.formMode = 'edit';
    this.formData = { name: client.name || '', email: client.email || '', password: '', phone: client.phone || '' };
    this.editClientId = client._id;
    this.formError = '';
    this.showForm = true;
    this.closeClientInfo();
  }

  closeForm(): void {
    this.showForm = false;
  }

  async saveForm(): Promise<void> {
    this.formError = '';
    this.formSaving = true;
    try {
      if (this.formMode === 'create') {
        if (!this.formData.name || !this.formData.email || !this.formData.password) {
          this.formError = 'Tutti i campi sono obbligatori';
          return;
        }
        await lastValueFrom(this.userService.createClient(this.formData));
        this.loadClients();
      } else if (this.formMode === 'edit') {
        if (!this.formData.name) {
          this.formError = 'Il nome è obbligatorio';
          return;
        }
        await lastValueFrom(this.userService.updateUserDetailsById(this.editClientId, this.formData.name, this.formData.phone));
        this.loadClients();
      }
      this.showForm = false;
    } catch (e: any) {
      this.formError = e?.error?.message || e?.message || 'Errore durante il salvataggio';
    } finally {
      this.formSaving = false;
    }
  }

  async deleteClient(client: any): Promise<void> {
    const confirmed = await this.confirmModalService.open({
      title: 'Elimina cliente',
      message: `Eliminare ${client.name}?`,
      confirmText: 'Elimina',
      cancelText: 'Annulla',
    });
    if (!confirmed) return;
    try {
      await lastValueFrom(this.userService.deleteClient(client._id));
      this.clients = this.clients.filter((c) => c._id !== client._id);
      this.closeClientInfo();
    } catch (e) {
      console.error('Error deleting client', e);
    }
  }

  async openClientInfo(client: any): Promise<void> {
    this.selectedClient = client;
    this.clientBookings = [];
    this.clientBookingsLoading = true;
    this.stripeTransactions = null;
    this.stripeTransactionsLoading = true;
    try {
      const res: any = await lastValueFrom(this.bookingsService.getBookingsByUserId(client._id));
      this.clientBookings = res.booking || [];
    } catch (e) {
      console.error('Error loading client bookings', e);
    } finally {
      this.clientBookingsLoading = false;
    }
    try {
      const txRes: any = await lastValueFrom(this.stripeService.getTransactionsByEmail(client.email));
      this.stripeTransactions = txRes.result || null;
    } catch (e) {
      console.error('Error loading stripe transactions', e);
    } finally {
      this.stripeTransactionsLoading = false;
    }
  }

  closeClientInfo(): void {
    this.selectedClient = null;
    this.clientBookings = [];
    this.clientActivity = [];
    this.stripeTransactions = null;
  }

  getRoleLabel(roleValue: number): string {
    return ROLES.find((r) => r.value === roleValue)?.label || `ROLE(${roleValue})`;
  }

  async changeRole(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const newRole = parseInt(select.value);
    if (isNaN(newRole) || !this.selectedClient) return;
    if (newRole === this.selectedClient.role) return;

    this.roleSaving = true;
    try {
      await lastValueFrom(this.userService.updateClientRole(this.selectedClient._id, newRole));
      this.selectedClient.role = newRole;
    } catch (e) {
      console.error('Error updating role', e);
      select.value = String(this.selectedClient.role);
    } finally {
      this.roleSaving = false;
    }
  }

  private async refreshClientBookings(): Promise<void> {
    if (!this.selectedClient) return;
    try {
      const res: any = await lastValueFrom(this.bookingsService.getBookingsByUserId(this.selectedClient._id));
      this.clientBookings = res.booking || [];
    } catch (e) {
      console.error('Error refreshing client bookings', e);
    }
  }

  private addActivity(action: string, booking: string, status: 'success' | 'error', message?: string): void {
    this.clientActivity.unshift({ action, booking, time: new Date(), status, message });
    if (this.clientActivity.length > 20) {
      this.clientActivity = this.clientActivity.slice(0, 20);
    }
  }

  async refundBooking(booking: any): Promise<void> {
    const LUGGAGE_PRICE = 2;

    let ticketRows = '';
    for (const t of booking.ticketTypes) {
      if (t.count > 0) {
        const ticketName = t.name?.it || t.name?.en || 'Biglietto';
        ticketRows += `
          <div class="d-flex align-items-center justify-content-between mb-2 px-2">
            <div class="text-start">
              <div class="fw-bold" style="font-size:0.85rem">${ticketName}</div>
              <div class="text-secondary" style="font-size:0.75rem">${t.cost}€ x ${t.count}</div>
            </div>
            <div class="d-flex align-items-center gap-2">
              <button type="button" class="btn btn-outline-secondary btn-sm px-2" onclick="document.getElementById('swal-t-${t.id}').stepDown(); window.swalUpdateTotal()">−</button>
              <input id="swal-t-${t.id}" type="number" class="form-control form-control-sm text-center" 
                style="width:55px" min="0" max="${t.count}" step="1" value="0" 
                data-cost="${t.cost}" data-ticket-id="${t.id}" 
                onchange="window.swalUpdateTotal()" />
              <button type="button" class="btn btn-outline-secondary btn-sm px-2" onclick="document.getElementById('swal-t-${t.id}').stepUp(); window.swalUpdateTotal()">+</button>
            </div>
          </div>`;
      }
    }

    if (booking.luggage > 0) {
      ticketRows += `
        <div class="d-flex align-items-center justify-content-between mb-2 px-2 border-top pt-2">
          <div class="text-start">
            <div class="fw-bold" style="font-size:0.85rem">Bagagli extra</div>
            <div class="text-secondary" style="font-size:0.75rem">${LUGGAGE_PRICE}€ x ${booking.luggage}</div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <button type="button" class="btn btn-outline-secondary btn-sm px-2" onclick="document.getElementById('swal-luggage').stepDown(); window.swalUpdateTotal()">−</button>
            <input id="swal-luggage" type="number" class="form-control form-control-sm text-center" 
              style="width:55px" min="0" max="${booking.luggage}" step="1" value="0" 
              data-cost="${LUGGAGE_PRICE}" data-ticket-id="__luggage__"
              onchange="window.swalUpdateTotal()" />
            <button type="button" class="btn btn-outline-secondary btn-sm px-2" onclick="document.getElementById('swal-luggage').stepUp(); window.swalUpdateTotal()">+</button>
          </div>
        </div>`;
    }

    const { value: refundChoice } = await Swal.fire({
      title: `Rimborso #${booking.numberOfTickets}`,
      html: `
        <div class="text-start">
          ${ticketRows}
          <hr class="my-2">
          <div class="d-flex justify-content-between px-2 mb-2">
            <span class="fw-bold">Totale rimborso:</span>
            <span id="swal-refund-total" class="fw-bold text-primary">0.00€</span>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Rimborsa',
      cancelButtonText: 'Annulla',
      customClass: {
        confirmButton: 'btn btn-warning btn-lg me-2',
        cancelButton: 'btn btn-secondary btn-lg',
        popup: 'rounded-4 glass',
      },
      didOpen: () => {
        (window as any).swalUpdateTotal = () => {
          let sum = 0;
          document.querySelectorAll<HTMLInputElement>('input[data-cost]').forEach((el) => {
            const c = parseFloat(el.dataset['cost'] || '0');
            const v = parseInt(el.value) || 0;
            sum += c * v;
          });
          const totalEl = document.getElementById('swal-refund-total');
          if (totalEl) totalEl.textContent = sum.toFixed(2) + '€';
        };
      },
      preConfirm: () => {
        const items: { ticketTypeId: string; count: number }[] = [];
        let luggageCount = 0;
        let hasSelection = false;
        document.querySelectorAll<HTMLInputElement>('input[data-cost]').forEach((el) => {
          const v = parseInt(el.value) || 0;
          if (v > 0) {
            hasSelection = true;
            if (el.dataset['ticketId'] === '__luggage__') {
              luggageCount = v;
            } else if (el.dataset['ticketId']) {
              items.push({ ticketTypeId: el.dataset['ticketId']!, count: v });
            }
          }
        });
        if (!hasSelection) {
          Swal.showValidationMessage('Seleziona almeno un biglietto da rimborsare');
          return;
        }
        return { items, luggage: luggageCount };
      },
    });

    if (!refundChoice) return;

    this.bookingActionLoading = booking.numberOfTickets;
    try {
      await lastValueFrom(this.stripeService.refund(booking.numberOfTickets, refundChoice.items, refundChoice.luggage));
      this.addActivity('Rimborso', `#${booking.numberOfTickets}`, 'success');
      await this.refreshClientBookings();
    } catch (e: any) {
      this.addActivity('Rimborso', `#${booking.numberOfTickets}`, 'error', e?.error?.message || e?.message);
    } finally {
      this.bookingActionLoading = null;
    }
  }

  async deleteBooking(booking: any): Promise<void> {
    const confirmed = await this.confirmModalService.open({
      title: 'Elimina biglietto',
      message: `Eliminare il biglietto #${booking.numberOfTickets}?`,
      confirmText: 'Elimina',
      cancelText: 'Annulla',
    });
    if (!confirmed) return;
    this.bookingActionLoading = booking.numberOfTickets;
    try {
      await lastValueFrom(this.stripeService.delete(booking.numberOfTickets));
      this.addActivity('Eliminazione', `#${booking.numberOfTickets}`, 'success');
      await this.refreshClientBookings();
    } catch (e: any) {
      this.addActivity('Eliminazione', `#${booking.numberOfTickets}`, 'error', e?.error?.message || e?.message);
    } finally {
      this.bookingActionLoading = null;
    }
  }

  async forceDeleteBooking(booking: any): Promise<void> {
    const confirmed = await this.confirmModalService.open({
      title: 'Eliminazione forzata',
      message: `Forzare l'eliminazione del biglietto #${booking.numberOfTickets}?`,
      confirmText: 'Forza eliminazione',
      cancelText: 'Annulla',
    });
    if (!confirmed) return;
    this.bookingActionLoading = booking.numberOfTickets;
    try {
      await lastValueFrom(this.stripeService.forceDelete(booking.numberOfTickets));
      this.addActivity('Eliminazione forzata', `#${booking.numberOfTickets}`, 'success');
      await this.refreshClientBookings();
    } catch (e: any) {
      this.addActivity('Eliminazione forzata', `#${booking.numberOfTickets}`, 'error', e?.error?.message || e?.message);
    } finally {
      this.bookingActionLoading = null;
    }
  }
}
