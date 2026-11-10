import { Component, ChangeDetectionStrategy } from '@angular/core';

import { Router, RouterModule } from '@angular/router';
import { LngService } from '../../services/lng/lng.service';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { version } from '../../../../package.json';
import { BRAND_VIEW } from '../../../brand';
@Component({
  selector: 'app-footer',
  imports: [RouterModule, TranslatePipe],
  templateUrl: './footer.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  readonly brand = BRAND_VIEW;
  currentYear = new Date().getFullYear();

  constructor(private router: Router, private lngService: LngService) {}
  /** Lingue attive (Impostazioni -> Lingue). */
  public get lng() {
    return this.lngService.languageOptions;
  }
  public setLng(lng: string) {
    this.lngService.changeLng(lng);
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
