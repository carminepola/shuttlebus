import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { UserService } from '../../services/user/user.service';
import { fadeAnimation } from '../../animations/fade.animation';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pending-users',
  imports: [
    TitlePageComponent,
    LoadingComponent,
    FormsModule,
    CommonModule,
  ],
  templateUrl: './pending-users.component.html',
  styleUrl: './pending-users.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeAnimation],
})
export class PendingUsersComponent implements OnInit, AfterViewInit, OnDestroy {
  searchTerm: string = '';
  loading: boolean = false;
  loadingMore: boolean = false;
  users: any[] = [];
  currentPage = 1;
  itemsPerPage = 25;
  hasMore = true;
  private intersectionObserver!: IntersectionObserver;

  constructor(private userService: UserService) {}

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
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !this.loading && !this.loadingMore && this.hasMore) {
            this.loadMoreUsers();
          }
        });
      },
      { root: null, rootMargin: '300px', threshold: 0.01 },
    );

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

  loadUsers(): void {
    this.loading = true;
    this.users = [];
    this.currentPage = 1;
    this.hasMore = true;

    this.userService
      .getNoPermissionUsers(this.currentPage, this.itemsPerPage)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response: any) => {
          this.users = response.users || [];
          this.hasMore = response.users?.length === this.itemsPerPage;
          setTimeout(() => this.observeSentinel(), 100);
        },
        error: (error: any) => {
          console.error('Error loading pending users:', error);
        },
      });
  }

  loadMoreUsers(): void {
    if (this.loadingMore || !this.hasMore) return;

    this.loadingMore = true;
    this.currentPage++;

    this.userService
      .getNoPermissionUsers(this.currentPage, this.itemsPerPage)
      .pipe(finalize(() => (this.loadingMore = false)))
      .subscribe({
        next: (response: any) => {
          const newUsers = response.users || [];
          this.users = [...this.users, ...newUsers];
          this.hasMore = newUsers.length === this.itemsPerPage;
          setTimeout(() => this.observeSentinel(), 100);
        },
        error: (error: any) => {
          console.error('Error loading more pending users:', error);
          this.currentPage--;
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
      .searchNoPermissionUsers(this.searchTerm, this.currentPage, this.itemsPerPage)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response: any) => {
          this.users = response.users || [];
          this.hasMore = response.users?.length === this.itemsPerPage;
          setTimeout(() => this.observeSentinel(), 100);
        },
        error: (error: any) => {
          console.error('Error searching pending users:', error);
        },
      });
  }

  onSearchTermChange(): void {
    this.onSearch();
  }

  copyPin(pin: string): void {
    navigator.clipboard.writeText(pin).then(() => {}).catch(() => {});
  }
}
