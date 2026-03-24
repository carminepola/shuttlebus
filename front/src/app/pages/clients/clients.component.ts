import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { UserService } from '../../services/user/user.service';
import { fadeAnimation } from '../../animations/fade.animation';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-clients',
  imports: [
    TitlePageComponent,
    RouterModule,
    LoadingComponent,
    FormsModule,
    CommonModule,
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

  constructor(
    private router: Router,
    private userService: UserService,
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

    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
      this.observeSentinel();
    }, 100);
  }

  observeSentinel(): void {
    const sentinel = document.getElementById('infinite-scroll-sentinel');
    if (sentinel) {
      // Disconnect first to avoid duplicate observations
      this.intersectionObserver.disconnect();
      this.intersectionObserver.observe(sentinel);
      console.log('Infinite scroll sentinel observed');
    } else {
      console.error('Infinite scroll sentinel not found');
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
          // Re-observe sentinel after initial load
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
          // Re-observe sentinel after loading more data
          setTimeout(() => this.observeSentinel(), 100);
        },
        error: (error: any) => {
          console.error('Error loading more clients:', error);
          this.currentPage--; // Revert page increment on error
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
          // Re-observe sentinel after search
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
}
