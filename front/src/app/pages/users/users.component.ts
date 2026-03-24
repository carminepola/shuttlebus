import { Component, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { UserService } from '../../services/user/user.service';
import { lastValueFrom } from 'rxjs';
import { fadeAnimation } from '../../animations/fade.animation';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FilterPipe } from '../../pipe/filter.pipe';

@Component({
  selector: 'app-users',
  imports: [
    TitlePageComponent,
    RouterModule,
    TitlePageComponent,
    CommonModule,
    FormsModule,
    FilterPipe,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  users: any[] = [];
  loading = true;
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  totalPages = 0;
  searchTerm = '';

  constructor(
    private router: Router,
    private userService: UserService,
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.userService.getUsers(this.currentPage, this.itemsPerPage).subscribe({
      next: (response: any) => {
        this.users = response.users || [];
        this.totalItems = response.pagination?.totalCount || 0;
        this.totalPages = response.pagination?.totalPages || 0;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading users:', error);
        this.loading = false;
      },
    });
  }

  onSearch(): void {
    if (this.searchTerm.trim() === '') {
      this.loadUsers();
      return;
    }

    this.loading = true;
    this.userService
      .searchUsers(this.searchTerm, this.currentPage, this.itemsPerPage)
      .subscribe({
        next: (response: any) => {
          this.users = response.users || [];
          this.totalItems = response.pagination?.totalCount || 0;
          this.totalPages = response.pagination?.totalPages || 0;
          this.loading = false;
        },
        error: (error: any) => {
          console.error('Error searching users:', error);
          this.loading = false;
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

  deleteUser(userId: string): void {
    if (confirm('Sei sicuro di voler eliminare questo utente?')) {
      // Implement delete logic here
      console.log('Delete user:', userId);
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
