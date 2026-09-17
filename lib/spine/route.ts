/**
 * Working out the order to drive the day in.
 *
 * Deliberately needs no database change: addresses are already on jobs, the
 * coordinates are looked up in the browser and kept in localStorage, and the
 * order is computed each time rather than stored. That means it works today
 * rather than after a migration, and when there is a geocodes table the only
 * thing that moves is where the cache lives.
 *
 * Straight-line distance, not drive time. For a metro-area round the ordering
 * comes out the same the overwhelming majority of the time, and the one
 * function to swap later is `metres`.
 */

export interface Stop {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** Minutes on site. A guess until somebody tells us otherwise. */
  minutes: number;
}

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle metres between two points. */
export function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Rough driving minutes. Town speeds, plus a little for turning around. */
export const driveMinutes = (m: number) => Math.round((m / 1000 / 35) * 60) + 2;

/**
 * Nearest neighbour, then 2-opt until it stops improving.
 *
 * Nearest neighbour alone reliably strands one stop at the far end and drives
 * back for it. 2-opt un-crosses the route, which is the part a person looking
 * at a map would do by eye, and on twenty stops it finishes instantly.
 */
export function order(stops: Stop[], start?: { lat: number; lng: number }): Stop[] {
  if (stops.length < 3) return stops;

  const left = [...stops];
  const out: Stop[] = [];
  let at = start ?? left[0];

  while (left.length) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < left.length; i++) {
      const d = metres(at, left[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    at = left[best];
    out.push(left.splice(best, 1)[0]);
  }

  const total = (r: Stop[]) => {
    let sum = start ? metres(start, r[0]) : 0;
    for (let i = 0; i < r.length - 1; i++) sum += metres(r[i], r[i + 1]);
    return sum;
  };

  let improved = true;
  let guard = 0;
  while (improved && guard++ < 60) {
    improved = false;
    for (let i = 0; i < out.length - 1; i++) {
      for (let k = i + 1; k < out.length; k++) {
        const trial = [...out.slice(0, i), ...out.slice(i, k + 1).reverse(), ...out.slice(k + 1)];
        if (total(trial) < total(out) - 1) {
          out.splice(0, out.length, ...trial);
          improved = true;
        }
      }
    }
  }
  return out;
}

/** Total metres and minutes for a finished order. */
export function summarise(route: Stop[], start?: { lat: number; lng: number }) {
  let m = start && route.length ? metres(start, route[0]) : 0;
  for (let i = 0; i < route.length - 1; i++) m += metres(route[i], route[i + 1]);
  const drive = driveMinutes(m);
  const onSite = route.reduce((n, s) => n + s.minutes, 0);
  return { metres: m, driveMinutes: drive, onSiteMinutes: onSite, totalMinutes: drive + onSite };
}

/* ----------------------------------------------------------------- geocode */

const KEY = 'nautilus.geocode.v1';

type Cache = Record<string, { lat: number; lng: number } | null>;

function readCache(): Cache {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Cache; } catch { return {}; }
}
function writeCache(c: Cache) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* full or blocked */ }
}

export const normalise = (a: string) => a.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * One address to coordinates, cached forever.
 *
 * OpenStreetMap's public geocoder: no key, no account, and no per-address
 * charge. It asks for no more than one request a second, so lookups are
 * spaced — which only bites the first time a round is opened, because a hit
 * is never looked up twice.
 */
export async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = normalise(address);
  if (!key) return null;

  const cache = readCache();
  if (key in cache) return cache[key];

  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
    encodeURIComponent(address);

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json = (await res.json()) as Array<{ lat: string; lon: string }>;
    const hit = json[0]
      ? { lat: Number(json[0].lat), lng: Number(json[0].lon) }
      : null;
    cache[key] = hit;
    writeCache(cache);
    return hit;
  } catch {
    return null;
  }
}

/** A multi-stop link anybody can open on a phone. */
export function mapsLink(route: Stop[], start?: { lat: number; lng: number }): string {
  const pts = route.map((s) => `${s.lat},${s.lng}`);
  const origin = start ? `${start.lat},${start.lng}` : pts[0];
  const destination = pts[pts.length - 1];
  const waypoints = pts.slice(start ? 0 : 1, -1).join('|');
  return (
    'https://www.google.com/maps/dir/?api=1' +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}` +
    (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : '') +
    '&travelmode=driving'
  );
}
