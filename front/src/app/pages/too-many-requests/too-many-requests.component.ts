import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LngService } from '../../services/lng/lng.service';

@Component({
  selector: 'app-too-many-requests',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './too-many-requests.component.html',
  styleUrl: './too-many-requests.component.scss',
})
export class TooManyRequestsComponent implements OnInit {
  translatedTitle = '';
  translatedDesc = '';
  translatedBtn = '';

  constructor(private lngService: LngService) {}

  ngOnInit(): void {
    try {
      this.translatedTitle =
        this.lngService.traslate('str_too_many_requests') || 'Troppe richieste';
      this.translatedDesc =
        this.lngService.traslate('str_too_many_requests_desc') ||
        'Hai effettuato troppe richieste. Riprova tra qualche minuto.';
      this.translatedBtn =
        this.lngService.traslate('str_torna_home') || 'Torna alla home';
    } catch {
      this.translatedTitle = 'Troppe richieste';
      this.translatedDesc =
        'Hai effettuato troppe richieste. Riprova tra qualche minuto.';
      this.translatedBtn = 'Torna alla home';
    }
  }
}
