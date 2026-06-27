import { Component, ChangeDetectionStrategy } from '@angular/core';

import { Router, RouterModule } from '@angular/router';
import { LngService } from '../../services/lng/lng.service';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { version } from '../../../../package.json';
@Component({
  selector: 'app-footer',
  imports: [RouterModule, TranslatePipe],
  templateUrl: './footer.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  currentYear = new Date().getFullYear();

  constructor(private router: Router, private lngService: LngService) {}
  public lng = [
    { lng: 'it', name: '🇮🇹 Italiano' },
    { lng: 'en', name: '🇬🇧 English' },
    { lng: 'fr', name: '🇫🇷 Français' },
    { lng: 'de', name: '🇩🇪 Deutsch' },
    { lng: 'es', name: '🇪🇸 Español' },
    { lng: 'jp', name: '🇯🇵 日本語' },
  ];
  public setLng(lng: string) {
    this.lngService.setLng(lng);
    this.router.navigate([this.router.url]).then(() => {
      window.location.reload();
    });
  }
  public getSelectedLng() {
    let selected = this.lngService.getLng();
    return this.lng.find(l => l.lng === selected) || this.lng[0];
  }
  getVersion() {
    return version;
  }
  public traduci = (id: string) => this.lngService.traslate(id);
}
