import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { UserService } from '../../services/user/user.service';
import { BookingsService } from '../../services/bookings/bookings.service';
import { fadeAnimation } from '../../animations/fade.animation';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { TranslateNamePipe } from '../../pipe/translateName.pipe';
import { lastValueFrom } from 'rxjs';

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
  animations: [fadeAnimation],
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
  formData = { name: '', email: '', password: '' };
  formError = '';

  selectedClient: any = null;
  clientBookings: any[] = [];
  clientBookingsLoading = false;
  roleSaving = false;

  constructor(
    private router: Router,
    private userService: UserService,
    private bookingsService: BookingsService,
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
    this.formData = { name: '', email: '', password: '' };
    this.formError = '';
    this.showForm = true;
  }

  openEditForm(client: any): void {
    this.formMode = 'edit';
    this.formData = { name: client.name || '', email: client.email || '', password: '' };
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
      }
      this.showForm = false;
    } catch (e: any) {
      this.formError = e?.error?.message || e?.message || 'Errore durante il salvataggio';
    } finally {
      this.formSaving = false;
    }
  }

  async deleteClient(client: any): Promise<void> {
    if (!confirm(`Eliminare ${client.name}?`)) return;
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
    try {
      const res: any = await lastValueFrom(this.bookingsService.getBookingsByUserId(client._id));
      this.clientBookings = res.booking || [];
    } catch (e) {
      console.error('Error loading client bookings', e);
    } finally {
      this.clientBookingsLoading = false;
    }
  }

  closeClientInfo(): void {
    this.selectedClient = null;
    this.clientBookings = [];
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
}
