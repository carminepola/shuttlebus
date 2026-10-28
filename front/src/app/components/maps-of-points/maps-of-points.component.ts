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
// Oltre questa distanza (es. primo caricamento, scheda rimasta in background) si salta.
const MAX_ANIMATED_METERS = 5000;
// Se la freccia è entro questa distanza dal nuovo percorso vi si aggancia e prosegue,
// altrimenti lo raggiunge in linea retta.
const SNAP_METERS = 40;
// Tempo (s) in cui la freccia recupera lo scarto tra dove si trova e dove il bus
// dovrebbe essere: più alto = correzioni più morbide, più basso = più precise.
const CATCH_UP_SECONDS = 4;
// Limite alla velocità di recupero (m/s), per evitare scatti dopo un fix lontano.
const MAX_CATCH_UP_SPEED = 40;

const BUS_ARROW_SVG = `
  <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
    <path d="M20 3 L34 35 L20 27 L6 35 Z" fill="#0d6efd" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
  </svg>`;

const STOP_PIN_SVG = `
  <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true">
    <path d="M16 1C9.9 1 5 5.8 5 11.8 5 20 16 31 16 31s11-11 11-19.2C27 5.8 22.1 1 16 1z"
      fill="#e83e8c" stroke="#fff" stroke-width="2"/>
    <circle cx="16" cy="12" r="4.5" fill="#fff"/>
  </svg>`;

interface BusMarker {
  marker: L.Marker;
  angle: number;
  // Percorso corrente (strada già percorsa + previsione) e distanze cumulative.
  path: L.LatLng[];
  cumulative: number[];
  // Distanza lungo il percorso dove si trova la freccia.
  travelled: number;
  // Distanza lungo il percorso dell'ultimo fix GPS, istante del fix e velocità (m/s):
  // la posizione attesa avanza da lì a velocità costante.
  fixDistance: number;
  fixAt: number;
  speed: number;
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
  private frame: number | null = null;
  private lastFrameAt = 0;

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

  // Icone SVG interne: con immagini esterne bloccate (tracking protection, rete)
  // Leaflet mostrava al loro posto il testo alternativo "Marker" sovrapposto.
  private stopIcon = L.divIcon({
    html: STOP_PIN_SVG,
    className: 'stop-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28],
  });

  private stopIconInteractive = L.divIcon({
    html: STOP_PIN_SVG,
    className: 'stop-marker interactive-stop-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -32],
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

      // ngsw-bypass: le tile non passano dal service worker. Con la pagina controllata
      // dal SW (dopo il primo F5) Firefox bloccava le immagini cross-origin rifatte dal worker.
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png?ngsw-bypass=true', {
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
    const toLatLngs = (list: [number, number][] | undefined) => (list ?? []).map((p) => L.latLng(p[0], p[1]));
    const trail = toLatLngs(point.trail);
    const ahead = toLatLngs(point.ahead);
    const speed = Number(point.speed) > 0 ? Number(point.speed) : 0;
    const fixAt = performance.now() - (Number(point.age) > 0 ? Number(point.age) : 0) * 1000;

    // Percorso stradale dal backend: tratto percorso (finisce sul fix) + previsione
    // (parte dal fix). `fixIndex` è il punto del fix dentro il percorso.
    const route: L.LatLng[] = trail.length >= 2 ? trail.slice() : [target];
    const fixIndex = route.length - 1;
    route.push(...ahead.slice(1));

    let bus = this.busMarkers.get(id);
    if (!bus) {
      const marker = L.marker(target, { icon: this.busIcon, zIndexOffset: 1000 })
        .addTo(this.busesLayer)
        .bindPopup(this.buildPopup(point));
      bus = { marker, angle: 0, path: [], cumulative: [], travelled: 0, fixDistance: 0, fixAt, speed };
      this.busMarkers.set(id, bus);
      this.setHeading(bus, Number(point.currentAngle) || 0);
      this.setRoute(bus, route.slice(fixIndex), 0, 0, fixAt, speed, true);
      return;
    }

    bus.marker.setPopupContent(this.buildPopup(point));
    const shown = bus.marker.getLatLng();

    if (shown.distanceTo(target) > MAX_ANIMATED_METERS) {
      this.setRoute(bus, route.slice(fixIndex), 0, 0, fixAt, speed, true);
      return;
    }

    // Se la freccia è già sul nuovo percorso (dietro o davanti al fix) prosegue da lì,
    // così una correzione non la fa mai tornare indietro né tagliare le curve.
    const snap = this.projectOnPath(shown, route);
    if (snap && snap.distance <= SNAP_METERS) {
      const rest = [shown, ...route.slice(snap.index + 1)];
      const fixDistance = this.distanceAlong(route, snap.index, snap.point, fixIndex);
      this.setRoute(bus, rest, 0, fixDistance, fixAt, speed);
    } else {
      const rest = [shown, ...route.slice(fixIndex)];
      this.setRoute(bus, rest, 0, shown.distanceTo(target), fixAt, speed);
    }

    if (!speed && point.currentAngle != null && bus.path.length < 2) {
      this.setHeading(bus, Number(point.currentAngle));
    }
  }

  private setRoute(
    bus: BusMarker,
    path: L.LatLng[],
    travelled: number,
    fixDistance: number,
    fixAt: number,
    speed: number,
    jump = false
  ) {
    bus.path = path;
    bus.cumulative = [0];
    for (let i = 1; i < path.length; i++) {
      bus.cumulative.push(bus.cumulative[i - 1] + path[i - 1].distanceTo(path[i]));
    }
    bus.travelled = travelled;
    bus.fixDistance = fixDistance;
    bus.fixAt = fixAt;
    bus.speed = speed;
    if (jump) {
      bus.travelled = Math.min(this.expectedDistance(bus, performance.now()), this.pathLength(bus));
      this.placeMarker(bus);
    }
    this.startLoop();
  }

  // Un solo requestAnimationFrame per tutti i bus. Ogni frame la freccia avanza alla
  // velocità stimata più una correzione proporzionale allo scarto dalla posizione
  // attesa: niente blocchi tra un aggiornamento e l'altro, niente salti all'arrivo.
  private startLoop() {
    if (this.frame !== null) return;
    this.lastFrameAt = performance.now();
    const step = (now: number) => {
      // Scheda in background: rAF si ferma, al ritorno si recupera senza superare 1 s.
      const dt = Math.min((now - this.lastFrameAt) / 1000, 1);
      this.lastFrameAt = now;
      let moving = false;

      for (const bus of this.busMarkers.values()) {
        const total = this.pathLength(bus);
        const gap = this.expectedDistance(bus, now) - bus.travelled;
        // Bus fermo: la freccia scivola sul fix, anche all'indietro se la previsione
        // l'aveva portata oltre (es. bus fermo alla fermata), poi si ferma.
        if (!bus.speed) {
          if (Math.abs(gap) < 0.5) continue;
          bus.travelled = Math.max(bus.travelled + (gap / CATCH_UP_SECONDS) * dt, 0);
          this.placeMarker(bus, gap > 0);
          moving = true;
          continue;
        }
        const velocity = Math.min(Math.max(bus.speed + gap / CATCH_UP_SECONDS, 0), Math.max(MAX_CATCH_UP_SPEED, bus.speed));
        if (velocity <= 0) {
          moving ||= bus.speed > 0;
          continue;
        }
        if (bus.travelled >= total) continue;
        bus.travelled = Math.min(bus.travelled + velocity * dt, total);
        this.placeMarker(bus);
        moving = true;
      }

      this.frame = moving ? requestAnimationFrame(step) : null;
    };
    this.frame = requestAnimationFrame(step);
  }

  private expectedDistance(bus: BusMarker, now: number): number {
    return Math.min(bus.fixDistance + (bus.speed * (now - bus.fixAt)) / 1000, this.pathLength(bus));
  }

  private pathLength(bus: BusMarker): number {
    return bus.cumulative[bus.cumulative.length - 1] ?? 0;
  }

  private placeMarker(bus: BusMarker, updateHeading = true) {
    const { path, cumulative } = bus;
    if (path.length < 2) {
      if (path.length) bus.marker.setLatLng(path[0]);
      return;
    }
    let i = 1;
    while (i < path.length - 1 && cumulative[i] < bus.travelled) i++;
    const from = path[i - 1];
    const to = path[i];
    const segLength = cumulative[i] - cumulative[i - 1];
    const t = segLength > 0 ? Math.min(Math.max((bus.travelled - cumulative[i - 1]) / segLength, 0), 1) : 1;
    bus.marker.setLatLng([from.lat + (to.lat - from.lat) * t, from.lng + (to.lng - from.lng) * t]);
    // Sotto il metro la direzione del segmento è rumore: si mantiene l'ultima.
    if (updateHeading && segLength > 1) this.setHeading(bus, this.bearing(from, to));
  }

  // Punto del percorso più vicino a `p`: indice del segmento, punto proiettato, distanza (m).
  private projectOnPath(p: L.LatLng, path: L.LatLng[]) {
    if (path.length < 2) return null;
    // Piano locale in metri centrato su `p`: preciso a sufficienza su poche centinaia di metri.
    const kx = 111320 * Math.cos((p.lat * Math.PI) / 180);
    const ky = 110540;
    const xy = (q: L.LatLng) => [(q.lng - p.lng) * kx, (q.lat - p.lat) * ky];
    let best: { index: number; point: L.LatLng; distance: number } | null = null;
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, ay] = xy(path[i]);
      const [bx, by] = xy(path[i + 1]);
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? Math.min(Math.max(-(ax * dx + ay * dy) / len2, 0), 1) : 0;
      const distance = Math.hypot(ax + dx * t, ay + dy * t);
      if (!best || distance < best.distance) {
        best = {
          index: i,
          point: L.latLng(path[i].lat + (path[i + 1].lat - path[i].lat) * t, path[i].lng + (path[i + 1].lng - path[i].lng) * t),
          distance,
        };
      }
    }
    return best;
  }

  // Distanza lungo il percorso dal punto `point` (sul segmento `index`) al vertice
  // `target`; negativa se il vertice è alle spalle.
  private distanceAlong(path: L.LatLng[], index: number, point: L.LatLng, target: number): number {
    if (target > index) {
      let d = point.distanceTo(path[index + 1]);
      for (let i = index + 1; i < target; i++) d += path[i].distanceTo(path[i + 1]);
      return d;
    }
    let d = -point.distanceTo(path[index]);
    for (let i = index; i > target; i--) d -= path[i - 1].distanceTo(path[i]);
    return d;
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
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.busMarkers.clear();
    this.map?.remove();
  }
}
