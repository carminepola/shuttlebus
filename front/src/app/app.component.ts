import { Component, OnInit } from '@angular/core';
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
import { version } from '../../package.json';
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
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  navbarVisible: boolean = false;
  lowBarVisible: boolean = false;
  loading: boolean = true;
  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private authService: AuthService,
    private cookieService: CookieWatcherServiceService,
    private lngService: LngService
  ) {}

  ngOnInit() {
    console.log(this.getVersion());
    this.loadLng();

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
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
      }
    });
    /*  this.router.events.subscribe(() => {
      // Ottieni i dati dalla route corrente

      const routeData = this.activatedRoute.snapshot.data;
      console.log(routeData);
      if (routeData && routeData['navbar'] !== undefined) {
        this.navbarVisible = routeData['navbar'];
      } else {
        this.navbarVisible = false; // Se non ci sono dati, nascondi la navbar
      }
      if (routeData && routeData['lowBar'] !== undefined) {
        this.lowBarVisible = routeData['lowBar'];
      } else {
        this.lowBarVisible = false; // Se non ci sono dati, nascondi la navbar
      }
    });*/

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
    let browserLanguage = navigator.language;
    let lng = 'it';
    if (browserLanguage != 'it-IT') {
      lng = 'en';
    }

    if (!localStorage['currentLng']) {
      this.lngService.setLng(lng);
    }

    this.lngService.get().subscribe((res) => {
      if (res && res.lng) {
        this.loading = false;
        sessionStorage['lng'] = JSON.stringify(res.lng);
      }
    });
  }

  autoDarkMode() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    document.body.setAttribute(
      'data-bs-theme',
      prefersDark.matches ? 'dark' : 'light'
    );
    //force light
    // document.body.setAttribute(
    //   'data-bs-theme',
    //   prefersDark.matches ? 'light' : 'light'
    // );
  }
  getVersion() {
    return version;
  }
}
