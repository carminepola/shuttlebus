import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, ActivatedRoute } from '@angular/router';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth/auth.service';
import { CookieWatcherServiceService } from './services/cookieWatcher/cookie-watcher-service.service';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SidebarComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  navbarVisible: boolean = false;

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private authService: AuthService,
    private cookieService: CookieWatcherServiceService
  ) { }

  ngOnInit() {
    this.router.events.subscribe(() => {
      // Ottieni i dati dalla route corrente
      const routeData = this.activatedRoute.snapshot.firstChild?.data;

      if (routeData && routeData['navbar'] !== undefined) {
        this.navbarVisible = routeData['navbar'];
      } else {
        this.navbarVisible = false; // Se non ci sono dati, nascondi la navbar
      }
    });

    // window
    //   .matchMedia('(prefers-color-scheme: dark)')
    //   .addEventListener('change', (event) => {
    //     if (localStorage['theme'] === 'auto') {
    //       this.autoDarkMode();
    //     }
    //   });

    this.cookieService.startWatchingJwtChanges();
    document.body.setAttribute('data-bs-theme', 'light');
    // Sottoscriviti al comportamento del JWT per ottenere gli aggiornamenti
    this.cookieService.watchCookie().subscribe((newJwtToken: any) => {

      try {
        let mode = 'auto';
        if (newJwtToken?.options?.theme == 'dark') mode = 'dark';
        if (newJwtToken?.options?.theme == 'light') mode = 'light';

        if (mode == 'auto') {
          localStorage['theme'] = mode;
          this.autoDarkMode();
        } else {
          localStorage.removeItem('theme');
          document.body.setAttribute('data-bs-theme', mode);
        }
      } catch (error) {
        console.error(error);
      }
    });
  }

  autoDarkMode() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    document.body.setAttribute(
      'data-bs-theme',
      prefersDark.matches ? 'dark' : 'light'
    );
  }
}
