import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { LngService } from '../../services/lng/lng.service';
import { TranslatePipe } from '../../pipe/translate.pipe';
@Component({
  selector: 'app-footer',
  imports: [RouterModule, CommonModule, TranslatePipe],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  constructor(private router: Router, private lngService: LngService) {}
  public lng = [
    {
      lng: 'it',
      name: '🇮🇹 Italiano',
    },
    {
      lng: 'en',
      name: '🇺🇸 English',
    },
  ];
  public setLng(lng: string) {
    this.lngService.setLng(lng);
    this.router.navigate([this.router.url]).then(() => {
      window.location.reload();
    });
  }
  public getSelectedLng() {
    let selected = this.lngService.getLng();
    if (selected == 'it') {
      return this.lng[0];
    } else {
      return this.lng[1];
    }
  }
  public traduci = (id: string) => this.lngService.traslate(id);
}
