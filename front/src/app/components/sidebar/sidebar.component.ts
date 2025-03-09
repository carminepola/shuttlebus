import {
  Component,
  EventEmitter,
  input,
  Input,
  Output,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
interface MenuItem {
  icon: string;
  title: string;
  route: string;
}
import { CookieWatcherServiceService } from '../../services/cookieWatcher/cookie-watcher-service.service';
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent implements OnInit {
  constructor(
    private cookieService: CookieWatcherServiceService,
    private authService: AuthService,
    private router: Router
  ) {}

  username = '';
  isMenuOpen = false;
  private user: any;
  isLoadingLogout: boolean = false;
  notification: any = [];

  image = '';

  ngOnInit(): void {
    debugger;
    this.user = this.authService.getDecodedToken();

    this.cookieService.watchCookie().subscribe((newJwtToken) => {
      this.user = newJwtToken;
      this.username = this.user?.details?.name.split(' ')[0].toUpperCase();
      if (this.user?.options?.google?.photos?.length > 0) {
        this.image = this.user.options.google.photos[0].value;
      }
    });
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
    { icon: 'fa-users', title: 'Clienti', route: '/admin/clienti' },
    { icon: 'fa-user', title: 'Utenti', route: '/admin/utenti' },
    { icon: 'fa-cog', title: 'Impostazioni', route: '/admin/settings' },
  ];
}
