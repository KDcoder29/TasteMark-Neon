// Exact positions: distances, "850 m" labels, reading lat/lng out of Google Maps links, and the
// places within a radius. Everything is worked out on the device (no paid map service).

const num = v => typeof v === 'number' && Number.isFinite(v)

export function hasCoords(p) {
  return !!p && num(p.lat) && num(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180
}

// loc_source: gps / link / pin = an exact spot someone set; area = worked out automatically from the
// landmark and city (good to about a kilometre, shown with "≈"). lat/lng without a loc_source are
// old automatic guesses from an earlier experiment: never used.
const EXACT = ['gps', 'link', 'pin']
export const isExact = p => hasCoords(p) && EXACT.includes(p.loc_source)
export const isLocated = p => isExact(p) || (hasCoords(p) && p.loc_source === 'area')

// straight-line ("as the crow flies") distance on the Earth's surface
export function distanceKm(a, b) {
  const rad = d => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 100) * 10} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

const N = '(-?\\d{1,3}(?:\\.\\d+)?)'
// most exact first: !3d!4d is the place itself; @lat,lng is only where the map was centred
const PATTERNS = [
  new RegExp(`!3d${N}!4d${N}`),
  new RegExp(`[?&](?:q|query|ll|destination|daddr)=${N},\\s*${N}(?:&|$)`),
  new RegExp(`/(?:place|search)/${N},\\s*${N}(?:[/?]|$)`),
  new RegExp(`@${N},${N}`),
]

export function coordsFromMapsUrl(url) {
  if (typeof url !== 'string' || !url) return null
  let s = url
  try { s = decodeURIComponent(url) } catch {}
  for (const re of PATTERNS) {
    const m = s.match(re)
    if (!m) continue
    const p = { lat: +m[1], lng: +m[2] }
    if (hasCoords(p)) return p
  }
  return null
}

// maps.app.goo.gl/… hides the position: it has to be opened (api/maps-resolve) to find it
export function isShortMapsLink(url) {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    const h = u.hostname.toLowerCase()
    return (h === 'maps.app.goo.gl' && u.pathname.length > 1) || (h === 'goo.gl' && u.pathname.startsWith('/maps'))
  } catch { return false }
}

// the items within radiusKm of me, nearest first, each with .km
export function nearby(items, me, radiusKm) {
  return items
    .filter(isLocated)
    .map(p => ({ ...p, km: distanceKm(me, p) }))
    .filter(p => p.km <= radiusKm)
    .sort((a, b) => a.km - b.km)
}

// Near me has no distance limit: every located place, nearest first (with .km); without your
// position, by name
export function sortByDistance(items, me) {
  const located = items.filter(isLocated)
  if (!me) return [...located].sort((a, b) => String(a.name).localeCompare(String(b.name)))
  return located.map(p => ({ ...p, km: distanceKm(me, p) })).sort((a, b) => a.km - b.km)
}

// the city you're in: the city of your nearest place, if it's within 40 km
export function homeCity(items, me) {
  if (!me) return null
  const [first] = sortByDistance(items, me)
  return first && first.km <= 40 ? first.city || null : null
}

// a place's best dish (group dishes carry their average as .rating); 0 when nothing is rated
export const bestRating = p => Math.max(0, ...(p?.dishes || []).map(d => d.rating || 0))

// pin colour by that rating: the greener, the better
export function pinColor(r) {
  if (r >= 4.5) return 'var(--pri)'
  if (r >= 3.5) return '#3b9c74'
  if (r >= 2.5) return '#c9a227'
  if (r > 0) return '#c2410c'
  return 'var(--faint)'
}

// exact spots by their coordinates; an area-level one by name, landmark and city, so Google takes
// you to the place itself (its first search result), not to the middle of the area
export function directionsUrl(p) {
  const dir = 'https://www.google.com/maps/dir/?api=1&destination='
  if (isExact(p)) return `${dir}${p.lat},${p.lng}`
  const q = [p?.name, p?.area, p?.city].map(v => String(v || '').trim()).filter(Boolean).join(', ')
  return isLocated(p) && q ? dir + encodeURIComponent(q) : null
}

export const distanceLabel = p => (isExact(p) ? '' : '≈ ') + formatDistance(p.km)
