import {
  Component,
  EventEmitter,
  input,
  Input,
  Output,
  OnInit,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
interface MenuItem {
  icon: string;
  title: string;
  route: string;
  roles?: number[];
}
import { CookieWatcherServiceService } from '../../services/cookieWatcher/cookie-watcher-service.service';
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent implements OnInit {
  constructor(
    private cookieService: CookieWatcherServiceService,
    private authService: AuthService,
    private router: Router,
  ) {}

  username = '';
  isMenuOpen = false;
  private user: any;
  isLoadingLogout: boolean = false;
  notification: any = [];

  image = '';
  userRole = 9999;

  ngOnInit(): void {
    this.user = this.authService.getDecodedToken();
    this.setUserData(this.user);

    this.cookieService.watchCookie().subscribe((newJwtToken) => {
      this.user = newJwtToken;
      this.setUserData(this.user);
    });
  }

  private setUserData(user: any) {
    this.username = user?.details?.name?.split(' ')[0]?.toUpperCase() || '';
    this.userRole = user?.role ?? 9999;
    if (user?.options?.google?.photos?.length > 0) {
      this.image = user.options.google.photos[0].value;
    }
  }
  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }
  onLogout() {
    this.isLoadingLogout = true;

    this.authService.logout().subscribe({
      next: (response) => {
        this.isLoadingLogout = false;
        this.authService.deleteCookie('jwt');

        this.router.navigate(['/']);
      },
      error: (error) => {
        this.isLoadingLogout = false;
        this.router.navigate(['/']);

        console.error('Errore durante il logout', error);
      },
    });
  }

  onMenuItemClick() {
    this.toggleMenu();
  }
  menuItems: MenuItem[] = [
    { icon: 'fa-home', title: 'Dashboard', route: '/admin/home' },
    { icon: 'fa-map-marker-alt', title: 'Fermate', route: '/admin/fermate' },
    { icon: 'fa-route', title: 'Corse', route: '/admin/corse' },
    { icon: 'fa-ticket-alt', title: 'Biglietti', route: '/admin/biglietti' },
    {
      icon: 'fa-calendar-check',
      title: 'Prenotazioni',
      route: '/admin/prenotazioni',
    },
    {
      icon: 'fa-gavel',
      title: 'Contestazioni',
      route: '/admin/contestazioni',
    },
    { icon: 'fa-brands fa-stripe-s', title: 'Stripe', route: '/admin/stripe' },
    { icon: 'fa-users', title: 'Clienti', route: '/admin/clienti' },
    {
      icon: 'fa-user-clock',
      title: 'In attesa',
      route: '/admin/utenti-in-attesa',
    },
    { icon: 'fa-user', title: 'Utenti', route: '/admin/utenti' },
    { icon: 'fa-cog', title: 'Impostazioni', route: '/admin/settings' },
    {
      icon: 'fa-envelope',
      title: 'Test Email',
      route: '/admin/test-email',
      roles: [1],
    },
  ];
}
