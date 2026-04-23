import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { UserService } from '../../services/user/user.service';
import { lastValueFrom } from 'rxjs';
import { fadeAnimation } from '../../animations/fade.animation';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FilterPipe } from '../../pipe/filter.pipe';
import { finalize } from 'rxjs/operators';
import { ConfirmModalService } from '../../services/confirm-modal/confirm-modal.service';

@Component({
  selector: 'app-users',
  imports: [
    TitlePageComponent,
    RouterModule,
    TitlePageComponent,
    LoadingComponent,
    CommonModule,
    FormsModule,
    FilterPipe,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit, AfterViewInit, OnDestroy {
  users: any[] = [];
  loading = true;
  loadingMore = false;
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;
  hasMore = true;
  searchTerm = '';
  private intersectionObserver!: IntersectionObserver;

  constructor(
    private router: Router,
    private userService: UserService,
    private confirmModalService: ConfirmModalService,
  ) {}

  ngOnInit(): void {
    this.loadUsers();
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
          this.loadMoreUsers();
        }
      });
    }, options);

    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
      this.observeSentinel();
    }, 100);
  }

  observeSentinel(): void {
    const sentinel = document.getElementById('users-infinite-scroll-sentinel');
    if (sentinel) {
      // Disconnect first to avoid duplicate observations
      this.intersectionObserver.disconnect();
      this.intersectionObserver.observe(sentinel);
      console.log('Users infinite scroll sentinel observed');
    } else {
      console.error('Users infinite scroll sentinel not found');
    }
  }

  loadUsers(): void {
    this.loading = true;
    this.users = [];
    this.currentPage = 1;
    this.hasMore = true;

    this.userService
      .getUsers(this.currentPage, this.itemsPerPage)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response: any) => {
          this.users = response.users || [];
          this.totalItems = response.pagination?.totalCount || 0;
          this.totalPages = response.pagination?.totalPages || 0;
          this.hasMore = response.users?.length === this.itemsPerPage;
          // Re-observe sentinel after initial load
          setTimeout(() => this.observeSentinel(), 100);
        },
        error: (error: any) => {
          console.error('Error loading users:', error);
        },
      });
  }

  loadMoreUsers(): void {
    if (this.loadingMore || !this.hasMore) return;

    this.loadingMore = true;
    this.currentPage++;

    this.userService
      .getUsers(this.currentPage, this.itemsPerPage)
      .pipe(finalize(() => (this.loadingMore = false)))
      .subscribe({
        next: (response: any) => {
          const newUsers = response.users || [];
          this.users = [...this.users, ...newUsers];
          this.totalItems = response.pagination?.totalCount || 0;
          this.totalPages = response.pagination?.totalPages || 0;
          this.hasMore = newUsers.length === this.itemsPerPage;
          // Re-observe sentinel after loading more data
          setTimeout(() => this.observeSentinel(), 100);
        },
        error: (error: any) => {
          console.error('Error loading more users:', error);
          this.currentPage--; // Revert page increment on error
        },
      });
  }

  onSearch(): void {
    if (this.searchTerm.trim() === '') {
      this.loadUsers();
      return;
    }

    this.loading = true;
    this.users = [];
    this.currentPage = 1;
    this.hasMore = true;

    this.userService
      .searchUsers(this.searchTerm, this.currentPage, this.itemsPerPage)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response: any) => {
          this.users = response.users || [];
          this.totalItems = response.pagination?.totalCount || 0;
          this.totalPages = response.pagination?.totalPages || 0;
          this.hasMore = response.users?.length === this.itemsPerPage;
          // Re-observe sentinel after search
          setTimeout(() => this.observeSentinel(), 100);
        },
        error: (error: any) => {
          console.error('Error searching users:', error);
        },
      });
  }

  onSearchTermChange(): void {
    this.currentPage = 1;
    this.onSearch();
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      if (this.searchTerm.trim() === '') {
        this.loadUsers();
      } else {
        this.onSearch();
      }
    }
  }

  onPreviousPage(): void {
    if (this.currentPage > 1) {
      this.onPageChange(this.currentPage - 1);
    }
  }

  onNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.onPageChange(this.currentPage + 1);
    }
  }

  getRoleName(role: string): string {
    const roleMap: { [key: string]: string } = {
      ADMIN: 'Amministratore',
      USER: 'Utente',
      NO_PERMISSION: 'Nessun permesso',
    };
    return roleMap[role] || role;
  }

  editUser(userId: string): void {
    this.router.navigate(['/admin/utente', userId]);
  }

  async deleteUser(userId: string): Promise<void> {
    const confirmed = await this.confirmModalService.open({
      title: 'Elimina utente',
      message: 'Sei sicuro di voler eliminare questo utente?',
      confirmText: 'Elimina',
      cancelText: 'Annulla',
    });
    if (!confirmed) return;
    try {
      await lastValueFrom(this.userService.deleteUser(userId));
      this.users = this.users.filter((u) => u._id !== userId);
    } catch (e) {
      console.error('Error deleting user:', e);
    }
  }

  getPages(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;

    if (this.totalPages <= maxVisiblePages) {
      // Show all pages if total pages is less than or equal to maxVisiblePages
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show a subset of pages with ellipsis
      if (this.currentPage <= 3) {
        // Show first 5 pages
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
      } else if (this.currentPage >= this.totalPages - 2) {
        // Show last 5 pages
        for (let i = this.totalPages - 4; i <= this.totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Show pages around current page
        for (let i = this.currentPage - 2; i <= this.currentPage + 2; i++) {
          pages.push(i);
        }
      }
    }

    return pages;
  }
}
