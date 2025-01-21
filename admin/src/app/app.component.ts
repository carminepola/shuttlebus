import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, ActivatedRoute } from '@angular/router';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth/auth.service';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SidebarComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})


export class AppComponent implements OnInit {

  navbarVisible: boolean = false;

  constructor(private router: Router, private activatedRoute: ActivatedRoute, private authService: AuthService) { }

  ngOnInit() {

    let user = this.authService.getDecodedToken();
    console.log(user)
    // Ascolta il cambiamento della route corrente
    this.router.events.subscribe(() => {
      // Ottieni i dati dalla route corrente
      const routeData = this.activatedRoute.snapshot.firstChild?.data;

      if (routeData && routeData['navbar'] !== undefined) {
        this.navbarVisible = routeData['navbar'];
      } else {
        this.navbarVisible = false; // Se non ci sono dati, nascondi la navbar
      }

      console.log('Navbar visibility:', this.navbarVisible); // Verifica che il valore sia corretto


    });

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
    const theme = user?.options?.theme || (prefersDark.matches ? 'dark' : 'light');

    prefersDark.addEventListener('change', event => {
      const theme = event.matches ? 'dark' : 'light';

      document.body.setAttribute('data-bs-theme', theme);

    });
    document.body.setAttribute('data-bs-theme', theme);


  }
}
