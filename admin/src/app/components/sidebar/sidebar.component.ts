import { Component, EventEmitter, input, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth/auth.service';
import { SidebarService } from '../../services/sidebar/sidebar.service';
interface MenuItem {
  icon: string;
  title: string;
  route: string;
}


@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit {


  constructor(private authService: AuthService, private router: Router) { }

  username = ""
  isMenuOpen = false;
  private user: any;
  isLoadingLogout: boolean = false;

  ngOnInit(): void {
    this.user = this.authService.getDecodedToken();
    this.username = this.user?.details?.name.toUpperCase();


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
        this.router.navigate(['/login']);

      },
      error: (error) => {
        this.isLoadingLogout = false;
        console.error('Errore durante il logout', error);
      }

    })


  }

  onMenuItemClick() {
    this.toggleMenu()
  }
  menuItems: MenuItem[] = [
    { icon: 'fa-home', title: 'Dashboard', route: '/home' },
    { icon: 'fa-map-marker-alt', title: 'Fermate', route: '/fermate' },
    { icon: 'fa-route', title: 'Corse', route: '/corse' },
    { icon: 'fa-ticket-alt', title: 'Biglietti', route: '/biglietti' },
    {
      icon: 'fa-calendar-check',
      title: 'Prenotazioni',
      route: '/prenotazioni',
    },
    { icon: 'fa-chart-line', title: 'Statistiche', route: '/stats' },
    { icon: 'fa-user', title: 'Profilo', route: '/profile' },
    { icon: 'fa-cog', title: 'Impostazioni', route: '/settings' },
  ];
}

