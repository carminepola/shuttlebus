import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title, Meta, MetaDefinition } from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { BRAND, BRAND_LOGO } from '../../../brand';
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
        content: BRAND.siteUrl + '/',
      },
      {
        property: 'og:image',
        content: BRAND.siteUrl + BRAND_LOGO,
      },
    ];

    tag.push({
      name: 'keywords',
      content: (localStorage.getItem('currentLng') !== 'en' ? BRAND.seo.it : BRAND.seo.en).pageKeywords,
    });

    for (const t of tag) {
      this.metaService.updateTag(t);
    }
  }

  goBack(): void {
    window.history.back();
  }
}
