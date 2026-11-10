import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
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
import { BRAND, BRAND_LOGO, BRAND_VIEW } from '../../../brand';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './homepage.component.scss',
})
export class HomepageComponent implements OnInit {
  readonly brand = BRAND_VIEW;
  /** Lingue attive (Impostazioni -> Lingue). */
  public get lng() {
    return this.lngService.languageOptions;
  }

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
    this.titleService.setTitle(this.brand.seo.homeTitle);

    const seo = localStorage.getItem('currentLng') == 'en' ? this.brand.seo.en : this.brand.seo.it;
    let title = seo.title;
    let subtitle = seo.description;

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
        content: BRAND.siteUrl + '/',
      },
      {
        property: 'og:image',
        content: BRAND.siteUrl + BRAND_LOGO,
      },
    ];

    tag.push({
      name: 'keywords',
      content: (localStorage.getItem('currentLng') !== 'en' ? BRAND.seo.it : BRAND.seo.en).homeKeywords,
    });

    for (const t of tag) {
      this.metaService.updateTag(t);
    }
  }

  setLng(lng: string) {
    this.lngService.changeLng(lng);
  }

  getSelectedLng() {
    const selected = this.lngService.getLng();
    return this.lng.find(l => l.lng === selected) || this.lng[0];
  }
}
