import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title, Meta, MetaDefinition } from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '../../pipe/translate.pipe';
@Component({
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  selector: 'app-title-page',
  templateUrl: './title-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./title-page.component.scss'],
})
export class TitlePageComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() back = '';
  @Input() id = '';

  constructor(private titleService: Title, private metaService: Meta) {}

  ngOnInit(): void {
    let title = this.title;
    if (this.id != '' && title != '') {
      title = title + ' - ' + this.id;
    }
    this.titleService.setTitle(title || 'Admin Panel');

    let tag: MetaDefinition[] = [
      {
        name: 'description',
        content: this.subtitle,
      },

      {
        name: 'robots',
        content: 'index, follow',
      },
      {
        property: 'og:title',
        content: title || 'Admin Panel',
      },
      {
        property: 'og:description',
        content: this.subtitle,
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
          'noleggio autobus,amalfi, napoli, airoporto, navetta, noleggio pullman, noleggio bus turistici, autobus con conducente, noleggio autobus gran turismo, autobus per gite scolastiche, autobus per viaggi organizzati, noleggio autobus gruppi, tour in autobus, viaggi in pullman organizzati, noleggio autobus per eventi, noleggio autobus matrimonio, noleggio autobus pellegrinaggi, pullman turistici, servizio navetta autobus, noleggio autobus low cost, noleggio autobus trasferte aziendali, autobus turismo Italia',
      });
    } else {
      tag.push({
        name: 'keywords',
        content:
          'bus rental, amalfi, napoli, airport, coach hire, tourist bus rental, charter bus, bus with driver, coach rental, school trip buses, organized trips by bus, group bus rental, bus tours Italy, organized coach trips, event bus rental, wedding bus rental, pilgrimage bus rental, tourist coach, shuttle bus service, low cost bus rental, corporate bus rental, bus travel Italy',
      });
    }

    for (const t of tag) {
      this.metaService.updateTag(t);
    }
  }

  goBack(): void {
    window.history.back();
  }
}
