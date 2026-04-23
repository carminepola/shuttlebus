import { Component, OnInit } from '@angular/core';
import { fadeAnimation } from '../../animations/fade.animation';
import { FooterComponent } from '../../components/footer/footer.component';
import { LngService } from '../../services/lng/lng.service';

import { TranslatePipe } from '../../pipe/translate.pipe';
import { Title, Meta, MetaDefinition } from '@angular/platform-browser';
import { MapsOfPointsComponent } from '../../components/maps-of-points/maps-of-points.component';
import { FormsModule } from '@angular/forms';
import { SearchComponent } from '../../components/search/search.component';
import { Router, RouterModule } from '@angular/router';
import { BusStatusComponent } from '../../components/bus-status/bus-status.component';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-homepage',
  imports: [
    FooterComponent,
    TranslatePipe,
    SearchComponent,
    MapsOfPointsComponent,
    RouterModule,
    BusStatusComponent,
    CommonModule,
  ],
  animations: [fadeAnimation],
  templateUrl: './homepage.component.html',
  styleUrl: './homepage.component.scss',
})
export class HomepageComponent implements OnInit {
  public lng = [
    { lng: 'it', name: '🇮🇹 Italiano' },
    { lng: 'en', name: '🇬🇧 English' },
    { lng: 'fr', name: '🇫🇷 Français' },
    { lng: 'de', name: '🇩🇪 Deutsch' },
    { lng: 'es', name: '🇪🇸 Español' },
    { lng: 'jp', name: '🇯🇵 日本語' },
  ];

  constructor(
    public router: Router,
    private titleService: Title,
    private metaService: Meta,
    private lngService: LngService,
  ) {}
  ngOnInit(): void {
    if (localStorage.getItem('authUrl')) {
      let url = localStorage.getItem('authUrl');
      if (url) {
        this.router.navigateByUrl(url);
      } else {
        localStorage.removeItem('ticket');
      }
    } else {
      localStorage.removeItem('ticket');
    }
  }
  updateMeta() {
    this.titleService.setTitle('Pintour');

    let title =
      'Con Pintourbus vivi la Campania con comfort e sicurezza: transfer dall’aeroporto di Napoli, escursioni agli scavi di Pompei, tour lungo la Costiera Amalfitana e viaggi organizzati verso Amalfi, Sorrento e le meraviglie del Sud Italia.';
    let subtitle = 'Viaggi sicuri e confortevoli in autobus in tutta Italia';

    if (localStorage.getItem('currentLng') == 'en') {
      title =
        'With Pintourbus you can discover Campania in comfort and safety: transfers from Naples airport, excursions to the ruins of Pompeii, tours along the Amalfi Coast, and organized trips to Amalfi, Sorrento and the wonders of Southern Italy';
      subtitle = 'Safe and comfortable bus travel throughout Italy';
    }

    let tag: MetaDefinition[] = [
      {
        name: 'description',
        content: subtitle,
      },

      {
        name: 'robots',
        content: 'index, follow',
      },
      {
        property: 'og:title',
        content: title,
      },
      {
        property: 'og:description',
        content: subtitle,
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:url',
        content: 'https://shuttlebus.pintourbus.com/',
      },
      {
        property: 'og:image',
        content: 'https://shuttlebus.pintourbus.com/assets/pintour-logo.png',
      },
    ];

    if (localStorage.getItem('currentLng') !== 'en') {
      tag.push({
        name: 'keywords',
        content:
          'noleggio autobus, noleggio pullman, noleggio bus turistici, autobus con conducente, noleggio autobus gran turismo, autobus per gite scolastiche, autobus per viaggi organizzati, noleggio autobus gruppi, tour in autobus, viaggi in pullman organizzati, noleggio autobus per eventi, noleggio autobus matrimonio, noleggio autobus pellegrinaggi, pullman turistici, servizio navetta autobus, noleggio autobus low cost, noleggio autobus trasferte aziendali, autobus turismo Italia',
      });
    } else {
      tag.push({
        name: 'keywords',
        content:
          'bus rental, coach hire, tourist bus rental, charter bus, bus with driver, coach rental, school trip buses, organized trips by bus, group bus rental, bus tours Italy, organized coach trips, event bus rental, wedding bus rental, pilgrimage bus rental, tourist coach, shuttle bus service, low cost bus rental, corporate bus rental, bus travel Italy',
      });
    }

    for (const t of tag) {
      this.metaService.updateTag(t);
    }
  }

  setLng(lng: string) {
    this.lngService.setLng(lng);
    this.router.navigate([this.router.url]).then(() => {
      window.location.reload();
    });
  }

  getSelectedLng() {
    const selected = this.lngService.getLng();
    return this.lng.find(l => l.lng === selected) || this.lng[0];
  }
}
