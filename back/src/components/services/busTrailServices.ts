import { logger } from "../..";

// Dati per animare i bus sulla mappa seguendo la strada:
//  - trail: strada percorsa dalla posizione GPS precedente a quella attuale;
//  - ahead: strada che il bus percorrerà presumibilmente, nella direzione di marcia;
//  - speed: velocità stimata (m/s) dagli ultimi due fix GPS;
//  - age:   secondi trascorsi dal fix GPS, per proiettare la posizione ad "adesso".
// Con questi il frontend fa avanzare la freccia in modo continuo anche tra un
// aggiornamento e l'altro. La cache è in memoria e condivisa tra le richieste:
// OSRM viene chiamato solo quando un bus si sposta, indipendentemente dai client.

type LatLng = [number, number];

interface BusTrail {
  to: LatLng;
  at: number;
  trail: LatLng[];
  ahead: LatLng[];
  speed: number;
}

const OSRM_URL = (process.env.OSRM_URL || "https://router.project-osrm.org").replace(/\/+$/, "");
const OSRM_TIMEOUT_MS = 3000;
// Sotto questa distanza lo spostamento è rumore GPS: niente routing.
const MIN_MOVE_METERS = 15;
// Oltre questa distanza (es. bus riacceso dopo ore) non ha senso animare.
const MAX_MOVE_METERS = 5000;
// Se la strada è molto più lunga della linea d'aria OSRM ha probabilmente agganciato
// la carreggiata opposta (inversione a U): meglio la linea retta.
const MAX_DETOUR_RATIO = 3;
// Velocità massima plausibile per uno shuttle (≈110 km/h): oltre è un salto GPS.
const MAX_SPEED = 30;
// Sotto questa velocità il bus è considerato fermo e non si prevede movimento.
const MIN_SPEED = 1;
// La previsione copre questo tempo di marcia, entro i limiti in metri.
const AHEAD_SECONDS = 120;
const AHEAD_MIN_METERS = 300;
const AHEAD_MAX_METERS = 3000;
// Senza corsa nota la previsione si ferma a questa distanza dalla posizione attuale.
const PROJECTION_MAX_METERS = 400;
// Se il bus non si muove per questo tempo la velocità stimata si azzera.
const STOPPED_AFTER_MS = 45000;

type UpcomingStops = (busId: string, lat: number, lng: number) => Promise<LatLng[]>;

const trails = new Map<string, BusTrail>();
const inFlight = new Map<string, Promise<void>>();

function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function pathLength(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distanceMeters(path[i - 1], path[i]);
  return total;
}

function bearing(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const y = Math.sin((b[1] - a[1]) * rad) * Math.cos(b[0] * rad);
  const x = Math.cos(a[0] * rad) * Math.sin(b[0] * rad) - Math.sin(a[0] * rad) * Math.cos(b[0] * rad) * Math.cos((b[1] - a[1]) * rad);
  return Math.atan2(y, x) / rad;
}

function destination(from: LatLng, bearingDeg: number, meters: number): LatLng {
  const rad = Math.PI / 180;
  const d = meters / 6371000;
  const lat1 = from[0] * rad;
  const lng1 = from[1] * rad;
  const brg = bearingDeg * rad;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg));
  const lng2 = lng1 + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [lat2 / rad, lng2 / rad];
}

// Direzione di arrivo sull'ultimo punto: si guarda indietro di qualche decina di metri,
// perché gli ultimi vertici (strada agganciata + fix GPS) sono spesso quasi sovrapposti.
function headingAt(path: LatLng[]): number {
  const end = path[path.length - 1];
  for (let i = path.length - 2; i >= 0; i--) {
    if (distanceMeters(path[i], end) >= 30 || i === 0) return bearing(path[i], end);
  }
  return 0;
}

// Taglia il percorso alla distanza indicata dall'inizio.
function truncate(path: LatLng[], meters: number): LatLng[] {
  const out: LatLng[] = [path[0]];
  let travelled = 0;
  for (let i = 1; i < path.length; i++) {
    const seg = distanceMeters(path[i - 1], path[i]);
    if (travelled + seg >= meters) {
      const t = seg > 0 ? (meters - travelled) / seg : 0;
      out.push([path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t]);
      return out;
    }
    travelled += seg;
    out.push(path[i]);
  }
  return out;
}

async function fetchRoute(points: LatLng[], heading?: number): Promise<LatLng[] | null> {
  const from = points[0];
  let url = `${OSRM_URL}/route/v1/driving/${points.map((p) => `${p[1]},${p[0]}`).join(";")}?overview=full&geometries=geojson`;
  // Con la direzione nota OSRM parte solo su strade orientate così: evita che la
  // previsione imbocchi la corsia opposta o faccia un'inversione.
  if (heading !== undefined) {
    const bearings = [`${Math.round(((heading % 360) + 360) % 360)},60`, ...points.slice(1).map(() => "")];
    url += `&bearings=${bearings.join(";")}&continue_straight=true`;
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(OSRM_TIMEOUT_MS) });
    if (!response.ok) return null;
    const body: any = await response.json();
    const coords: [number, number][] | undefined = body?.routes?.[0]?.geometry?.coordinates;
    if (!coords?.length) return null;
    // OSRM restituisce [lng, lat] e aggancia gli estremi alla strada: si rimette la
    // posizione GPS reale all'inizio così l'animazione combacia col marker.
    return [from, ...coords.map(([lng, lat]) => [lat, lng] as LatLng)];
  } catch (error) {
    logger.warn("busTrailServices: routing OSRM non disponibile", error);
    return null;
  }
}

// Strada che il bus percorrerà presumibilmente. Se è in corsa si segue la linea verso
// le prossime fermate; altrimenti si prosegue nella direzione attuale verso un punto
// vicino proiettato in avanti, che OSRM aggancia alla strada che il bus sta facendo.
async function fetchAhead(from: LatLng, heading: number, speed: number, upcomingStops: LatLng[]): Promise<LatLng[]> {
  if (speed < MIN_SPEED) return [];
  const meters = Math.min(Math.max(speed * AHEAD_SECONDS, AHEAD_MIN_METERS), AHEAD_MAX_METERS);

  if (upcomingStops.length) {
    const points = [from, ...upcomingStops];
    const route = await fetchRoute(points, heading);
    // Percorso molto più lungo della spezzata tra le fermate = corsa sbagliata o bus
    // fuori linea (deviazione, rientro al deposito): si usa la previsione generica.
    if (route && pathLength(route) <= pathLength(points) * MAX_DETOUR_RATIO + AHEAD_MIN_METERS) {
      return truncate(route, meters);
    }
  }

  // Proiezione corta: su lunghe distanze in linea retta finirebbe su un'altra strada.
  const projected = Math.min(meters, PROJECTION_MAX_METERS);
  const route = await fetchRoute([from, destination(from, heading, projected)], heading);
  // Percorso tortuoso = proiezione finita su un'altra strada o in un senso unico: meglio
  // non prevedere nulla che far fare alla freccia un giro sbagliato.
  if (!route || pathLength(route) > projected * 2) return [];
  return truncate(route, projected);
}

async function refreshTrail(busId: string, to: LatLng, at: number, angle: number | null, getUpcomingStops?: UpcomingStops): Promise<void> {
  const previous = trails.get(busId);
  if (!previous) {
    trails.set(busId, { to, at, trail: [], ahead: [], speed: 0 });
    return;
  }

  const from = previous.to;
  const moved = distanceMeters(from, to);
  if (moved < MIN_MOVE_METERS) {
    if (at - previous.at > STOPPED_AFTER_MS && previous.speed > 0) {
      trails.set(busId, { ...previous, speed: 0, ahead: [] });
    }
    return;
  }
  if (moved > MAX_MOVE_METERS) {
    trails.set(busId, { to, at, trail: [], ahead: [], speed: 0 });
    return;
  }

  const route = await fetchRoute([from, to]);
  const trail = route && pathLength(route) <= moved * MAX_DETOUR_RATIO ? [...route, to] : [from, to];

  const seconds = (at - previous.at) / 1000;
  let speed = seconds > 0 ? pathLength(trail) / seconds : 0;
  if (speed > MAX_SPEED) speed = 0;
  // Media con la stima precedente: attenua il rumore dei fix GPS ravvicinati.
  if (previous.speed > 0 && speed > 0) speed = (speed + previous.speed) / 2;

  const heading = angle ?? headingAt(trail);
  const upcoming = speed >= MIN_SPEED && getUpcomingStops ? await getUpcomingStops(busId, to[0], to[1]) : [];
  const ahead = await fetchAhead(to, heading, speed, upcoming);
  trails.set(busId, { to, at, trail, ahead, speed });
}

/**
 * Aggiunge a ogni bus i campi `trail`, `ahead` (polyline [lat, lng]), `speed` (m/s)
 * e `age` (secondi dal fix GPS). Campi vuoti/zero se il bus è fermo o appena comparso.
 * `getUpcomingStops` (prossime fermate della corsa) viene chiamato solo quando un bus
 * si è spostato, non a ogni richiesta.
 */
export async function attachTrails<T extends { busId?: any; currentLat?: number; currentLng?: number; currentAngle?: number; updatedAt?: any }>(
  buses: T[],
  getUpcomingStops?: UpcomingStops,
): Promise<(T & { trail: LatLng[]; ahead: LatLng[]; speed: number; age: number })[]> {
  const now = Date.now();
  const fixTime = (bus: T) => {
    const t = bus.updatedAt ? new Date(bus.updatedAt).getTime() : NaN;
    return isNaN(t) ? now : t;
  };

  await Promise.all(
    buses.map((bus) => {
      if (!bus?.busId || !bus.currentLat || !bus.currentLng) return Promise.resolve();
      const busId = String(bus.busId);
      const to: LatLng = [bus.currentLat, bus.currentLng];
      const cached = trails.get(busId);
      if (cached && cached.to[0] === to[0] && cached.to[1] === to[1]) return Promise.resolve();

      let pending = inFlight.get(busId);
      if (!pending) {
        const angle = bus.currentAngle != null && !isNaN(Number(bus.currentAngle)) ? Number(bus.currentAngle) : null;
        pending = refreshTrail(busId, to, fixTime(bus), angle, getUpcomingStops).finally(() => inFlight.delete(busId));
        inFlight.set(busId, pending);
      }
      return pending;
    }),
  );

  return buses.map((bus) => {
    const cached = bus?.busId ? trails.get(String(bus.busId)) : undefined;
    // Se lo spostamento era sotto soglia, `to` è rimasto quello vecchio: i dati valgono
    // solo se partono esattamente dalla posizione restituita.
    const valid = cached && cached.to[0] === bus.currentLat && cached.to[1] === bus.currentLng;
    const speed = valid && now - cached.at <= STOPPED_AFTER_MS + AHEAD_SECONDS * 1000 ? cached.speed : 0;
    return {
      ...bus,
      trail: valid ? cached.trail : [],
      ahead: valid && speed > 0 ? cached.ahead : [],
      speed,
      age: Math.max(0, (now - fixTime(bus)) / 1000),
    };
  });
}
