import { logger } from "../..";

// Percorso stradale tra l'ultima posizione nota di un bus e quella attuale, usato
// dal frontend per animare la freccia lungo la strada anziché in linea retta.
// La cache è in memoria e condivisa tra le richieste: OSRM viene chiamato una sola
// volta per ogni spostamento del bus, indipendentemente dal numero di client.

type LatLng = [number, number];

interface BusTrail {
  from: LatLng;
  to: LatLng;
  trail: LatLng[];
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

async function fetchRoute(from: LatLng, to: LatLng): Promise<LatLng[] | null> {
  const url = `${OSRM_URL}/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(OSRM_TIMEOUT_MS) });
    if (!response.ok) return null;
    const body: any = await response.json();
    const coords: [number, number][] | undefined = body?.routes?.[0]?.geometry?.coordinates;
    if (!coords?.length) return null;
    // OSRM restituisce [lng, lat] e aggancia gli estremi alla strada: si rimettono
    // le posizioni GPS reali agli estremi così l'animazione combacia col marker.
    return [from, ...coords.map(([lng, lat]) => [lat, lng] as LatLng), to];
  } catch (error) {
    logger.warn("busTrailServices: routing OSRM non disponibile", error);
    return null;
  }
}

async function refreshTrail(busId: string, to: LatLng): Promise<void> {
  const previous = trails.get(busId);
  if (!previous) {
    trails.set(busId, { from: to, to, trail: [] });
    return;
  }

  const from = previous.to;
  const moved = distanceMeters(from, to);
  if (moved < MIN_MOVE_METERS) return;
  if (moved > MAX_MOVE_METERS) {
    trails.set(busId, { from: to, to, trail: [] });
    return;
  }

  const route = await fetchRoute(from, to);
  const trail = route && pathLength(route) <= moved * MAX_DETOUR_RATIO ? route : [from, to];
  trails.set(busId, { from, to, trail });
}

/**
 * Aggiunge a ogni bus il campo `trail`: la polyline [lat, lng] percorsa dalla posizione
 * precedente a quella attuale (vuota se il bus è fermo o appena comparso).
 */
export async function attachTrails<T extends { busId?: any; currentLat?: number; currentLng?: number }>(buses: T[]): Promise<(T & { trail: LatLng[] })[]> {
  await Promise.all(
    buses.map((bus) => {
      if (!bus?.busId || !bus.currentLat || !bus.currentLng) return Promise.resolve();
      const busId = String(bus.busId);
      const to: LatLng = [bus.currentLat, bus.currentLng];
      const cached = trails.get(busId);
      if (cached && cached.to[0] === to[0] && cached.to[1] === to[1]) return Promise.resolve();

      let pending = inFlight.get(busId);
      if (!pending) {
        pending = refreshTrail(busId, to).finally(() => inFlight.delete(busId));
        inFlight.set(busId, pending);
      }
      return pending;
    }),
  );

  return buses.map((bus) => {
    const cached = bus?.busId ? trails.get(String(bus.busId)) : undefined;
    // Se lo spostamento era sotto soglia, `to` è rimasto quello vecchio: il trail
    // vale solo se finisce esattamente sulla posizione restituita.
    const valid = cached && cached.to[0] === bus.currentLat && cached.to[1] === bus.currentLng;
    return { ...bus, trail: valid ? cached.trail : [] };
  });
}
