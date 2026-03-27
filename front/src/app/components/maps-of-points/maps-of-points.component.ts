import { Component, OnInit, OnDestroy } from '@angular/core';
import * as L from 'leaflet';
import { StopsService } from '../../services/stops/stops.service';
import { MomapService } from '../../services/momap.service';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-maps-of-points',
  standalone: true,
  templateUrl: './maps-of-points.component.html',
  styleUrl: './maps-of-points.component.scss',
})
export class MapsOfPointsComponent implements OnInit, OnDestroy {
  private map!: L.Map;
  private markersLayer = L.layerGroup();
  private intervalId: any;

  constructor(
    private stopsService: StopsService,
    private momapService: MomapService
  ) {}

  // Icona per le fermate
  private stopIcon = L.icon({
    iconUrl: 'https://maps.google.com/mapfiles/kml/paddle/pink-blank.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });

  // Icona freccia orientata per i bus
  private getArrowIcon(angle: number): L.Icon {
    const normalizedAngle = ((angle % 360) + 360) % 360;
    const step = 360 / 16;
    const index = Math.round(normalizedAngle / step) % 16;

    return L.icon({
      iconUrl: `https://earth.google.com/images/kml-icons/track-directional/track-${index}.png`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  }

  async ngOnInit(): Promise<void> {
    // Inizializza la mappa
    this.map = L.map('map').setView([40.74894, 14.50349], 10);

    // Tile layer OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    this.markersLayer.addTo(this.map);

    // Caricamento iniziale e avvio aggiornamento
    await this.updateMarkers();
    this.intervalId = setInterval(() => this.updateMarkers(), 30000);
  }

  async updateMarkers() {
    this.markersLayer.clearLayers();

    try {
      const stops = await lastValueFrom(this.stopsService.getAllActiveStops());
      const momap = await lastValueFrom(this.momapService.getCurrent());

      // Fermate (marker rosa)
      if (stops?.stops?.length) {
        stops.stops.forEach((stop: any) => {
          if (stop.location?.latitude && stop.location?.longitude) {
            L.marker([stop.location.latitude, stop.location.longitude], {
              icon: this.stopIcon,
            })
              .addTo(this.markersLayer)
              .bindPopup(stop.name);
          }
        });
      }

      // Posizioni bus (frecce orientate)
      if (momap?.position?.length) {
        momap.position.forEach((point: any) => {
          if (point.currentLat > 0 && point.currentLng > 0) {
            let popupContent = '';
            if (point.plate) {
              popupContent += `<strong>${point.plate}</strong>`;
            }
            if (point.name) {
              if (popupContent) popupContent += '<br>';
              popupContent += point.name;
            }
            if (!popupContent) {
              popupContent = 'Autobus';
            }
            L.marker([point.currentLat, point.currentLng], {
              icon: this.getArrowIcon(point.currentAngle),
            })
              .addTo(this.markersLayer)
              .bindPopup(popupContent);
          }
        });
      }
    } catch (err) {
      console.error('Errore nel caricamento dei marker', err);
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
    this.map.remove();
  }
}
