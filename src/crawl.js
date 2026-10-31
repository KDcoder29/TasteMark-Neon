// Food crawl: pick 2-8 places, the free OSRM trip service puts them in the shortest order (fair use:
// only after a tap on Plan, cached 10 minutes). Google Maps then does the turn-by-turn.
import { isLocated, isExact } from './geo'

export const CRAWL_MIN = 2
export const CRAWL_MAX = 8
const TTL = 10 * 60000
const cache = new Map()
export const clearTripCache = () => cache.clear() // for tests

export const crawlStops = items => items.filter(isLocated).slice(0, CRAWL_MAX)

// start is you (or null: then the first stop is where the trip begins)
export const tripServiceUrl = (start, stops) => {
  const pts = [...(start ? [start] : []), ...stops]
  return `https://router.project-osrm.org/trip/v1/driving/${pts.map(p => `${p.lng},${p.lat}`).join(';')}?roundtrip=false&source=first&destination=any&overview=full&geometries=geojson`
}

// waypoints come back in the order we sent them; waypoint_index is each one's place in the trip
export function parseTrip(json, stops, hasStart) {
  const t = json?.code === 'Ok' ? json.trips?.[0] : null
  const wps = json?.waypoints
  if (!t || !Array.isArray(wps) || wps.length !== stops.length + (hasStart ? 1 : 0)) return null
  const mine = hasStart ? wps.slice(1) : wps
  const order = stops.map((s, i) => ({ s, at: mine[i].waypoint_index })).sort((x, y) => x.at - y.at).map(x => x.s)
  return {
    order,
    km: t.distance / 1000,
    min: Math.max(1, Math.round(t.duration / 60)),
    line: (t.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]),
  }
}

// exact spots by coordinates; an area-level one by "name, area, city" so Google finds the place itself
const stopText = p => (isExact(p) ? `${p.lat},${p.lng}`
  : encodeURIComponent([p.name, p.area, p.city].map(v => String(v || '').trim()).filter(Boolean).join(', ')))

export function googleDirectionsUrl(origin, ordered) {
  if (!ordered || ordered.length < CRAWL_MIN) return null
  const dest = ordered[ordered.length - 1]
  return 'https://www.google.com/maps/dir/?api=1&travelmode=driving'
    + (origin ? `&origin=${origin.lat},${origin.lng}` : '')
    + `&destination=${stopText(dest)}&waypoints=${ordered.slice(0, -1).map(stopText).join('%7C')}`
}

export async function getTrip(start, stops, { fetchFn = fetch, now = Date.now } = {}) {
  if (!stops || stops.length < CRAWL_MIN) return null
  const key = `${start ? `${start.lat.toFixed(3)},${start.lng.toFixed(3)}` : '-'}>${stops.map(s => s.key ?? s.id ?? `${s.lat},${s.lng}`).join('|')}`
  const hit = cache.get(key)
  if (hit && now() - hit.at < TTL) return hit.trip
  try {
    const res = await fetchFn(tripServiceUrl(start, stops))
    if (!res.ok) return null
    const trip = parseTrip(await res.json(), stops, !!start)
    if (trip) cache.set(key, { at: now(), trip })
    return trip
  } catch { return null }
}
