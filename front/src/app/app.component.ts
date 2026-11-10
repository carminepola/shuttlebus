import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import {
  RouterOutlet,
  Router,
  ActivatedRoute,
  ActivatedRouteSnapshot,
  NavigationEnd,
  NavigationStart,
} from '@angular/router';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth/auth.service';
import { CookieWatcherServiceService } from './services/cookieWatcher/cookie-watcher-service.service';
import { LowBarComponent } from './components/lowBar/lowBar.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { LngService } from './services/lng/lng.service';
import { LoadingComponent } from './components/loading/loading/loading.component';
import { CookiePolicyComponent } from './components/cookie-policy/cookie-policy.component';
import { ConfirmModalComponent } from './components/confirm-modal/confirm-modal.component';
import { PwaUpdateService } from './services/pwa/pwa-update.service';
import { version } from '../../package.json';
import { LanguagesService } from './services/languages/languages.service';
@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    LoadingComponent,
    SidebarComponent,
    CommonModule,
    LowBarComponent,
    NavbarComponent,
    CookiePolicyComponent,
    ConfirmModalComponent,
  ],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  navbarVisible: boolean = false;
  lowBarVisible: boolean = false;
  loading: boolean = true;
  constructor(
    private languagesService: LanguagesService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private authService: AuthService,
    private cookieService: CookieWatcherServiceService,
    private lngService: LngService,
    private pwaUpdateService: PwaUpdateService,
  ) {}

  ngOnInit() {
    console.log(this.getVersion());
    this.loadLng();
    this.pwaUpdateService.init();

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'instant' });
        }, 10);

        let currentRoute = this.activatedRoute;
        while (currentRoute.firstChild) {
          currentRoute = currentRoute.firstChild; // Scorri fino alla route figlia attiva
        }

        currentRoute.data.subscribe((routeData) => {
          this.navbarVisible =
            routeData['navbar'] !== undefined ? routeData['navbar'] : false;
          this.lowBarVisible =
            routeData['lowBar'] !== undefined ? routeData['lowBar'] : false;
        });
      }
    });
    this.cookieService.startWatchingJwtChanges();
    document.body.setAttribute('data-bs-theme', 'light');
    // Sottoscriviti al comportamento del JWT per ottenere gli aggiornamenti
    this.cookieService.watchCookie().subscribe((newJwtToken: any) => {
      try {
        let mode = 'light';
        if (newJwtToken?.options?.theme == 'dark') mode = 'dark';
        if (newJwtToken?.options?.theme == 'light') mode = 'light';

        if (mode == 'auto') {
          this.autoDarkMode();
        } else {
          document.body.setAttribute('data-bs-theme', mode);
        }
      } catch (error) {
        console.error(error);
      }
    });
  }

  loadLng() {
    // prima visita (o lingua disattivata): lingua del browser se attiva, confrontata anche
    // col locale (il browser dice "ja", il codice puo' essere "jp"), altrimenti la predefinita
    const saved = localStorage['currentLng'];
    if (!saved || !this.languagesService.isEnabled(saved)) {
      const browser = (navigator.language || '').toLowerCase();
      const base = browser.split('-')[0];
      const match = this.languagesService.enabled.find(
        (l) => l.code === browser || l.code === base || l.locale.toLowerCase() === browser || l.locale.split('-')[0].toLowerCase() === base,
      );
      this.lngService.setLng(match?.code || this.languagesService.defaultLanguage);
    } else {
      this.lngService.setLng(saved);
    }

    this.lngService.get().subscribe({
      next: (res) => {
        if (res && res.lng) {
          this.loading = false;
          sessionStorage['lng'] = JSON.stringify(res.lng);
        }
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 429) {
          this.router.navigate(['/too-many-requests']);
        } else {
          console.warn(
            'Errore caricamento traduzioni, uso valori di default:',
            err.message || err,
          );
        }
      },
    });
  }

  autoDarkMode() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    document.body.setAttribute(
      'data-bs-theme',
      prefersDark.matches ? 'dark' : 'light',
    );
  }
  getVersion() {
    return version;
  }
}
