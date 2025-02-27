import { Component, OnInit } from '@angular/core';
import {
  RouterOutlet,
  Router,
  ActivatedRoute,
  ActivatedRouteSnapshot,
  NavigationEnd,
} from '@angular/router';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth/auth.service';
import { CookieWatcherServiceService } from './services/cookieWatcher/cookie-watcher-service.service';
import { LowBarComponent } from './components/lowBar/lowBar.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { LngService } from './services/lng/lng.service';
import { LoadingComponent } from './components/loading/loading/loading.component';
@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    LoadingComponent,
    SidebarComponent,
    CommonModule,
    LowBarComponent,
    NavbarComponent,
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
    this.loadLng();
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        // Ottieni i dati della route attiva
        let currentRoute = this.activatedRoute;
        while (currentRoute.firstChild) {
          currentRoute = currentRoute.firstChild; // Scorri fino alla route figlia attiva
        }

        currentRoute.data.subscribe((routeData) => {
          console.log(routeData);
          this.navbarVisible =
            routeData['navbar'] !== undefined ? routeData['navbar'] : false;
          this.lowBarVisible =
            routeData['lowBar'] !== undefined ? routeData['lowBar'] : false;
        });
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

  loadLng() {
    this.lngService.get().subscribe((res) => {
      if (res && res.lng) {
        debugger;
        this.loading = false;
        localStorage['lng'] = JSON.stringify(res.lng);
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
}
