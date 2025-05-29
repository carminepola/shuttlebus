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

  getArrowIcon(angle: number): L.Icon {
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
    this.map = L.map('map').setView([40.74894, 14.50349], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);
    this.markersLayer.addTo(this.map);

    await this.updateMarkers();
    this.intervalId = setInterval(() => this.updateMarkers(), 30000);
  }

  async updateMarkers() {
    this.markersLayer.clearLayers();

    try {
      const stops = await lastValueFrom(this.stopsService.getAllActiveStops());
      const momap = await lastValueFrom(this.momapService.getCurrent());

      if (stops?.stops?.length) {
        stops.stops.forEach((stop: any) => {
          L.marker([stop.location.latitude, stop.location.longitude])
            .addTo(this.markersLayer)
            .bindPopup(stop.name);
        });
      }

      if (momap?.position?.length) {
        momap.position.forEach((point: any) => {
          if (point.currentLat > 0) {
            L.marker([point.currentLat, point.currentLng], {
              icon: this.getArrowIcon(point.currentAngle),
            }).addTo(this.markersLayer);
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
