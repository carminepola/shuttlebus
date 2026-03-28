import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import * as L from 'leaflet';
import { StopsService } from '../../services/stops/stops.service';
import { MomapService } from '../../services/momap.service';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-maps-of-points',
  standalone: true,
  templateUrl: './maps-of-points.component.html',
  styleUrl: './maps-of-points.component.scss',
  imports: [DatePipe],
})
export class MapsOfPointsComponent implements OnInit, OnDestroy {
  private map!: L.Map;
  private markersLayer = L.layerGroup();
  private intervalId: any;

  @Input() height = 500;
  @Input() showLegend = true;
  @Input() showLiveBadge = true;
  @Input() showStops = true;
  @Input() showBuses = true;
  @Input() interactiveStops = false;
  @Input() center: [number, number] | null = null;
  @Input() zoom: number | null = null;

  @Output() stopClick = new EventEmitter<{ id: string; name: string; lat: number; lng: number }>();

  loading = true;
  busCount = 0;
  stopCount = 0;
  lastUpdated: Date | null = null;

  constructor(
    private stopsService: StopsService,
    private momapService: MomapService
  ) {}

  private stopIcon = L.icon({
    iconUrl: 'https://maps.google.com/mapfiles/kml/paddle/pink-blank.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });

  private stopIconInteractive = L.icon({
    iconUrl: 'https://maps.google.com/mapfiles/kml/paddle/pink-blank.png',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    className: 'interactive-stop-marker',
  });

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
    const defaultCenter: [number, number] = this.center ?? [40.74894, 14.50349];
    const defaultZoom = this.zoom ?? 10;

    this.map = L.map('map').setView(defaultCenter, defaultZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    this.markersLayer.addTo(this.map);

    setTimeout(() => this.map.invalidateSize(), 300);

    await this.updateMarkers();
    this.intervalId = setInterval(() => this.updateMarkers(), 30000);
  }

  async updateMarkers() {
    this.markersLayer.clearLayers();
    this.busCount = 0;
    this.stopCount = 0;

    try {
      if (this.showStops) {
        const stops = await lastValueFrom(this.stopsService.getAllActiveStops());
        if (stops?.stops?.length) {
          stops.stops.forEach((stop: any) => {
            if (stop.location?.latitude && stop.location?.longitude) {
              this.stopCount++;
              const marker = L.marker(
                [stop.location.latitude, stop.location.longitude],
                {
                  icon: this.interactiveStops
                    ? this.stopIconInteractive
                    : this.stopIcon,
                }
              ).addTo(this.markersLayer);

              marker.bindPopup(stop.name);

              if (this.interactiveStops && stop._id) {
                marker.on('click', () => {
                  this.stopClick.emit({
                    id: stop._id,
                    name: stop.name,
                    lat: stop.location.latitude,
                    lng: stop.location.longitude,
                  });
                });
                (marker as any).bindTooltip(stop.name, {
                  direction: 'top',
                  offset: [0, -36],
                });
              }
            }
          });
        }
      }

      if (this.showBuses) {
        const momap = await lastValueFrom(this.momapService.getCurrent());
        if (momap?.position?.length) {
          momap.position.forEach((point: any) => {
            if (point.currentLat > 0 && point.currentLng > 0) {
              this.busCount++;
              let popupContent = '';
              if (point.plate) {
                popupContent += `<strong>${point.plate}</strong>`;
              }
              if (point.name) {
                if (popupContent) popupContent += '<br>';
                popupContent += point.name;
              }
              if (point.updatedAt) {
                const d = new Date(point.updatedAt);
                if (!isNaN(d.getTime())) {
                  const date = d.toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  });
                  const time = d.toLocaleTimeString('it-IT', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  if (popupContent) popupContent += '<br>';
                  popupContent += `<small style="color:#888">${date} ${time}</small>`;
                }
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
      }

      this.lastUpdated = new Date();
    } catch (err) {
      console.error('Errore nel caricamento dei marker', err);
    } finally {
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
    this.map.remove();
  }
}
