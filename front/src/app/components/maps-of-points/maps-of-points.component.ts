import {
  Component,
  AfterViewInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  NgZone,
  ChangeDetectionStrategy
} from '@angular/core';
import { DatePipe } from '@angular/common';
import * as L from 'leaflet';
import { StopsService } from '../../services/stops/stops.service';
import { MomapService } from '../../services/momap.service';
import { TranslatePipe } from '../../pipe/translate.pipe';
import { lastValueFrom } from 'rxjs';

const REFRESH_MS = 30000;
// L'animazione copre quasi tutto l'intervallo di aggiornamento: il bus scorre in
// modo continuo invece di fermarsi e ripartire a ogni polling.
const ANIMATION_MS = REFRESH_MS * 0.95;
// Oltre questa distanza (es. primo caricamento, scheda rimasta in background) si salta.
const MAX_ANIMATED_METERS = 5000;

const BUS_ARROW_SVG = `
  <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
    <circle cx="20" cy="20" r="15" fill="#0d6efd" stroke="#fff" stroke-width="3"/>
    <path d="M20 9 L28 27 L20 22.5 L12 27 Z" fill="#fff"/>
  </svg>`;

interface BusMarker {
  marker: L.Marker;
  angle: number;
  frame: number | null;
}

@Component({
  selector: 'app-maps-of-points',
  standalone: true,
  templateUrl: './maps-of-points.component.html',
  styleUrl: './maps-of-points.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [DatePipe, TranslatePipe],
})
export class MapsOfPointsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  private map?: L.Map;
  private stopsLayer = L.layerGroup();
  private busesLayer = L.layerGroup();
  private busMarkers = new Map<string, BusMarker>();
  private resizeObserver?: ResizeObserver;
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
    private momapService: MomapService,
    private zone: NgZone
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

  private busIcon = L.divIcon({
    html: `<div class="bus-arrow">${BUS_ARROW_SVG}</div>`,
    className: 'bus-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -16],
  });

  async ngAfterViewInit(): Promise<void> {
    // Leaflet fuori da Angular: zoom, pan e animazioni non scatenano change detection.
    this.zone.runOutsideAngular(() => {
      this.map = L.map(this.mapContainer.nativeElement, {
        attributionControl: false,
      }).setView(this.center ?? [40.74894, 14.50349], this.zoom ?? 10);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(this.map);

      this.stopsLayer.addTo(this.map);
      this.busesLayer.addTo(this.map);

      // Il contenitore può cambiare dimensione dopo l'init (layout a colonne,
      // animazioni d'ingresso): senza ricalcolo Leaflet disegna le tile sfalsate.
      this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
      this.resizeObserver.observe(this.mapContainer.nativeElement);
    });

    await Promise.all([this.loadStops(), this.updateBuses()]);
    this.loading = false;
    this.intervalId = setInterval(() => this.updateBuses(), REFRESH_MS);
  }

  private async loadStops() {
    if (!this.showStops) return;
    try {
      const stops = await lastValueFrom(this.stopsService.getAllActiveStops());
      this.stopsLayer.clearLayers();
      this.stopCount = 0;
      (stops?.stops ?? []).forEach((stop: any) => {
        if (!stop.location?.latitude || !stop.location?.longitude) return;
        this.stopCount++;
        const marker = L.marker([stop.location.latitude, stop.location.longitude], {
          icon: this.interactiveStops ? this.stopIconInteractive : this.stopIcon,
        }).addTo(this.stopsLayer);

        if (this.interactiveStops && stop._id) {
          // Solo tooltip: popup e tooltip insieme mostravano il nome due volte.
          marker.bindTooltip(stop.name, { direction: 'top', offset: [0, -36] });
          marker.on('click', () =>
            this.zone.run(() =>
              this.stopClick.emit({
                id: stop._id,
                name: stop.name,
                lat: stop.location.latitude,
                lng: stop.location.longitude,
              })
            )
          );
        } else {
          marker.bindPopup(stop.name);
        }
      });
    } catch (err) {
      console.error('Errore nel caricamento delle fermate', err);
    }
  }

  async updateBuses() {
    if (!this.showBuses) return;
    try {
      const momap = await lastValueFrom(this.momapService.getCurrent());
      const seen = new Set<string>();

      (momap?.position ?? []).forEach((point: any, index: number) => {
        if (!(point.currentLat > 0 && point.currentLng > 0)) return;
        const id = String(point.busId ?? point.plate ?? index);
        seen.add(id);
        this.zone.runOutsideAngular(() => this.upsertBus(id, point));
      });

      for (const [id, bus] of this.busMarkers) {
        if (seen.has(id)) continue;
        if (bus.frame !== null) cancelAnimationFrame(bus.frame);
        this.busesLayer.removeLayer(bus.marker);
        this.busMarkers.delete(id);
      }

      this.busCount = seen.size;
      this.lastUpdated = new Date();
    } catch (err) {
      console.error('Errore nel caricamento degli autobus', err);
    }
  }

  private upsertBus(id: string, point: any) {
    const target = L.latLng(point.currentLat, point.currentLng);
    const popup = this.buildPopup(point);
    let bus = this.busMarkers.get(id);

    if (!bus) {
      const marker = L.marker(target, { icon: this.busIcon, zIndexOffset: 1000 })
        .addTo(this.busesLayer)
        .bindPopup(popup);
      bus = { marker, angle: 0, frame: null };
      this.busMarkers.set(id, bus);
      this.setHeading(bus, Number(point.currentAngle) || 0);
      return;
    }

    bus.marker.setPopupContent(popup);
    const start = bus.marker.getLatLng();
    if (start.equals(target)) {
      if (point.currentAngle != null) this.setHeading(bus, Number(point.currentAngle));
      return;
    }

    // Percorso stradale calcolato dal backend; se non c'è, o non parte da dove il
    // marker si trova adesso, si collega la posizione attuale al suo inizio.
    const trail: L.LatLng[] = (point.trail ?? []).map((p: [number, number]) => L.latLng(p[0], p[1]));
    const path = trail.length >= 2 ? trail : [target];
    if (!path[0].equals(start)) path.unshift(start);

    if (start.distanceTo(target) > MAX_ANIMATED_METERS) {
      if (bus.frame !== null) cancelAnimationFrame(bus.frame);
      bus.frame = null;
      bus.marker.setLatLng(target);
      if (point.currentAngle != null) this.setHeading(bus, Number(point.currentAngle));
      return;
    }

    this.animateAlong(bus, path);
  }

  private animateAlong(bus: BusMarker, path: L.LatLng[]) {
    if (bus.frame !== null) cancelAnimationFrame(bus.frame);

    const cumulative = [0];
    for (let i = 1; i < path.length; i++) {
      cumulative.push(cumulative[i - 1] + path[i - 1].distanceTo(path[i]));
    }
    const total = cumulative[cumulative.length - 1];
    const startedAt = performance.now();
    let segment = 1;

    const step = (now: number) => {
      const travelled = Math.min((now - startedAt) / ANIMATION_MS, 1) * total;
      while (segment < path.length - 1 && cumulative[segment] < travelled) segment++;

      const from = path[segment - 1];
      const to = path[segment];
      const segLength = cumulative[segment] - cumulative[segment - 1];
      const t = segLength > 0 ? (travelled - cumulative[segment - 1]) / segLength : 1;

      bus.marker.setLatLng([
        from.lat + (to.lat - from.lat) * t,
        from.lng + (to.lng - from.lng) * t,
      ]);
      // Sotto il metro la direzione del segmento è rumore: si mantiene l'ultima.
      if (segLength > 1) this.setHeading(bus, this.bearing(from, to));

      bus.frame = travelled < total ? requestAnimationFrame(step) : null;
    };

    bus.frame = requestAnimationFrame(step);
  }

  private setHeading(bus: BusMarker, angle: number) {
    // Rotazione per la via più breve (da 350° a 10° gira di 20°, non di 340°),
    // accumulando l'angolo così la transizione CSS non torna indietro.
    const delta = ((((angle - bus.angle) % 360) + 540) % 360) - 180;
    if (Math.abs(delta) < 0.5) return;
    bus.angle += delta;
    const arrow = bus.marker.getElement()?.querySelector<HTMLElement>('.bus-arrow');
    if (arrow) arrow.style.transform = `rotate(${bus.angle}deg)`;
  }

  private bearing(from: L.LatLng, to: L.LatLng): number {
    const rad = Math.PI / 180;
    const y = Math.sin((to.lng - from.lng) * rad) * Math.cos(to.lat * rad);
    const x =
      Math.cos(from.lat * rad) * Math.sin(to.lat * rad) -
      Math.sin(from.lat * rad) * Math.cos(to.lat * rad) * Math.cos((to.lng - from.lng) * rad);
    return Math.atan2(y, x) / rad;
  }

  private buildPopup(point: any): string {
    const parts: string[] = [];
    if (point.plate) parts.push(`<strong>${this.escape(point.plate)}</strong>`);
    if (point.name) parts.push(this.escape(point.name));
    if (point.updatedAt) {
      const d = new Date(point.updatedAt);
      if (!isNaN(d.getTime())) {
        const date = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        parts.push(`<small style="color:#888">${date} ${time}</small>`);
      }
    }
    return parts.length ? parts.join('<br>') : 'Autobus';
  }

  private escape(value: unknown): string {
    const div = document.createElement('div');
    div.textContent = String(value);
    return div.innerHTML;
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
    this.resizeObserver?.disconnect();
    this.busMarkers.forEach((bus) => bus.frame !== null && cancelAnimationFrame(bus.frame));
    this.busMarkers.clear();
    this.map?.remove();
  }
}
