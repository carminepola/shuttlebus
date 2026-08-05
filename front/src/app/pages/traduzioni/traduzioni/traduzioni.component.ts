import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule, Router } from '@angular/router';
import { TitlePageComponent } from '../../../components/title-page/title-page.component';
import { LoadingComponent } from '../../../components/loading/loading/loading.component';
import { FormsModule, ReactiveFormsModule, NgForm } from '@angular/forms';
import { LngService } from '../../../services/lng/lng.service';
@Component({
  selector: 'app-traduzioni',
  imports: [TitlePageComponent, RouterModule, LoadingComponent, FormsModule, ReactiveFormsModule],
  templateUrl: './traduzioni.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './traduzioni.component.scss',
})
export class TraduzioniComponent implements OnInit {
  constructor(private router: Router,   private lngService: LngService) {}
  ngOnInit(): void {
    this.caricaTraduzioni();
  }

  traduzioni: any = [];
  loading: boolean = true;

  nuovaTraduzione: any = {
    txt: "",
    it: "",
    en: "",
    fr: "",
    de: "",
    es: "",
    jp: "",
  }
  traduci(id: string) {
    return this.lngService.traslate(id);
  }
  caricaTraduzioni() {
    this.lngService.get().subscribe((res) => {
      if (res && res.lng) {
        this.loading = false;
        this.traduzioni = res.lng;
        sessionStorage['lng'] = JSON.stringify(res.lng);
      }
    });
  }

  modificaTraduzione(id: string, it: string, en: string, fr: string, de: string, es: string, jp: string) {
    let obj = { id, it, en, fr, de, es, jp };
    this.loading = true;
    this.lngService.patch(obj).subscribe({
      next: () => this.caricaTraduzioni(),
      error: () => {
        this.loading = false;
      },
    });
  }

  aggiungiTraduzione(txt: string, it: string, en: string, fr: string, de: string, es: string, jp: string) {
    this.loading = true;
    this.lngService.post({
      txt, it, en, fr, de, es, jp,
    }).subscribe({
      next: () => {
        this.nuovaTraduzione = {
          txt: "",
          it: "",
          en: "",
          fr: "",
          de: "",
          es: "",
          jp: "",
        };
        this.caricaTraduzioni();
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
