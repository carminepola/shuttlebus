import { Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import Swal from 'sweetalert2';
import { LngService } from '../lng/lng.service';

/** Controllo periodico di una nuova versione pubblicata (6 ore). */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Aggiornamenti della PWA: il service worker scarica la nuova versione in
 * background; qui si chiede all'utente di ricaricare per usarla, senza
 * forzare il reload (potrebbe essere a meta' di una prenotazione).
 */
@Injectable({
  providedIn: 'root',
})
export class PwaUpdateService {
  private prompted = false;

  constructor(
    private swUpdate: SwUpdate,
    private lng: LngService,
  ) {}

  init(): void {
    // service worker disattivo in sviluppo o con browser non compatibile
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => this.promptReload());

    // cache corrotta o versione non piu' disponibile sul server: unica via e' ricaricare
    this.swUpdate.unrecoverable.subscribe(() => window.location.reload());

    setInterval(() => {
      this.swUpdate.checkForUpdate().catch(() => undefined);
    }, CHECK_INTERVAL_MS);
  }

  private async promptReload(): Promise<void> {
    if (this.prompted) return;
    this.prompted = true;
    const result = await Swal.fire({
      title: this.lng.traslateOr('str_pwa_update_title', 'Nuova versione disponibile'),
      text: this.lng.traslateOr('str_pwa_update_text', "Ricarica per usare l'ultima versione dell'app."),
      icon: 'info',
      position: 'top',
      showDenyButton: true,
      confirmButtonText: this.lng.traslateOr('str_pwa_update_reload', 'Ricarica'),
      denyButtonText: this.lng.traslateOr('str_pwa_update_later', 'Più tardi'),
      customClass: {
        confirmButton: 'btn btn-secondary btn-lg mr-2',
        denyButton: 'btn btn-outline-secondary btn-lg',
        popup: 'rounded-4 glass',
      },
    });
    if (result.isConfirmed) {
      await this.swUpdate.activateUpdate().catch(() => undefined);
      window.location.reload();
    } else {
      // rimandato: al prossimo avvio la nuova versione e' gia' attiva
      this.prompted = false;
    }
  }
}
