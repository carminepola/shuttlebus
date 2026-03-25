import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TitlePageComponent } from '../../components/title-page/title-page.component';
import { LoadingComponent } from '../../components/loading/loading/loading.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DepotSettingsService } from '../../services/depotSettings/depot-settings.service';

@Component({
  selector: 'app-deposito',
  imports: [
    TitlePageComponent,
    LoadingComponent,
    FormsModule,
    ReactiveFormsModule,
  ],
  templateUrl: './deposito.component.html',
  styleUrl: './deposito.component.scss',
})
export class DepositoComponent implements OnInit {
  constructor(
    public router: Router,
    private depotSettingsService: DepotSettingsService,
  ) {}

  ngOnInit(): void {
    this.caricaImpostazioni();
  }

  settings: any = {
    depotLatitude: 41.9028,
    depotLongitude: 12.4964,
    depotRadius: 500,
    gpsTimeout: 15,
    completedRouteTolerance: 30,
    stopDistanceThreshold: 500,
    defaultLastArrivalTime: '23:59',
  };
  loading: boolean = true;
  salvando: boolean = false;
  mostraMessaggio: boolean = false;
  tipoMessaggio: 'success' | 'error' = 'success';
  messaggio: string = '';

  caricaImpostazioni() {
    this.depotSettingsService.get().subscribe({
      next: (res) => {
        if (res && res.settings) {
          this.loading = false;
          this.settings = res.settings;
        }
      },
      error: (err) => {
        this.loading = false;
        this.mostraMessaggio = true;
        this.tipoMessaggio = 'error';
        this.messaggio =
          'Errore nel caricamento delle impostazioni: ' +
          (err.message || 'Errore sconosciuto');
        setTimeout(() => {
          this.mostraMessaggio = false;
        }, 5000);
      },
    });
  }

  salvaImpostazioni() {
    this.salvando = true;
    this.depotSettingsService.patch(this.settings).subscribe({
      next: (res) => {
        this.salvando = false;
        if (res) {
          this.mostraMessaggio = true;
          this.tipoMessaggio = 'success';
          this.messaggio = 'Impostazioni salvate con successo!';
          setTimeout(() => {
            this.mostraMessaggio = false;
          }, 5000);
        }
      },
      error: (err) => {
        this.salvando = false;
        this.mostraMessaggio = true;
        this.tipoMessaggio = 'error';
        this.messaggio =
          'Errore nel salvataggio delle impostazioni: ' +
          (err.message || 'Errore sconosciuto');
        setTimeout(() => {
          this.mostraMessaggio = false;
        }, 5000);
      },
    });
  }
}
