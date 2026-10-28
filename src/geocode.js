// Finding a place on the map from text, with Photon (photon.komoot.io): a free OpenStreetMap
// search with no API key. Only called when someone types in the map search or steps through
// Fix locations, so it stays far below fair use.
import { distanceKm } from './geo'

const API = 'https://photon.komoot.io/api/'

export function photonUrl(q, bias) {
  let url = `${API}?q=${encodeURIComponent(q)}&limit=5&lang=en`
  if (bias) url += `&lat=${bias.lat}&lon=${bias.lng}`
  return url
}

export function parsePhoton(json) {
  return (json?.features || []).map(f => {
    const pr = f.properties || {}
    const parts = [pr.name, pr.street, pr.city, pr.state].filter(Boolean)
    return { label: [...new Set(parts)].join(', '), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }
  })
}

// [] for short queries and on any error: search is a helper, never a blocker
export async function searchPlaces(q, bias, fetchFn = fetch) {
  const text = String(q || '').trim()
  if (text.length < 3) return []
  try {
    const r = await fetchFn(photonUrl(text, bias))
    return r.ok ? parsePhoton(await r.json()) : []
  } catch { return [] }
}

const join = (...xs) => xs.map(x => String(x || '').trim()).filter(Boolean).join(', ')

export const guessQuery = p => join(p.name, p.area, p.city)

// most precise first: the place itself, then its area, then the city (with how close to zoom in)
function levels(p) {
  const seen = new Set()
  return [
    [String(p.name || '').trim() ? guessQuery(p) : '', 'place', 17],
    [String(p.area || '').trim() ? join(p.area, p.city) : '', 'area', 15],
    [join(p.city), 'city', 12],
  ].filter(([q]) => q && !seen.has(q) && seen.add(q))
}

export const fallbackQueries = p => levels(p).map(([q]) => q)

// where the pin starts for a place with no position: the first level OpenStreetMap knows, or null
export async function guessSpot(p, fetchFn = fetch) {
  const name = String(p.name || '').trim().toLowerCase()
  for (const [q, found, zoom] of levels(p)) {
    const [hit] = await searchPlaces(q, null, fetchFn)
    // OpenStreetMap often answers with a different shop nearby: only a matching name is "the place"
    if (hit && (found !== 'place' || hit.label.split(', ')[0].toLowerCase().includes(name))) return { lat: hit.lat, lng: hit.lng, zoom, found }
  }
  return null
}

// ---- automatic, area-level position (saved as loc_source 'area', shown as "≈") ----
// OpenStreetMap knows areas and well-known landmarks well, small shops badly. So only the landmark
// / area field is looked up (never the shop's name), and an answer counts only when its name has
// every word you typed and it lies within 25 km of the city. Never the bare city centre.
const STOP = new Set(['road', 'rd', 'street', 'st', 'near', 'nr', 'opp', 'opposite', 'the', 'of', 'no', 'after', 'before', 'behind', 'next', 'and', 'cross'])
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
// every word counts, numbers and short ones too ("TP 13" must not match just any canal road)
const words = s => norm(s).split(' ').filter(w => w && !STOP.has(w))
// short words and numbers must be whole words of the name; longer ones may sit inside one
const hasWord = (name, w) => (w.length >= 4 ? name.includes(w) : name.split(' ').includes(w))
const CITY_KM = 25

async function features(q, fetchFn, extra = '') {
  try {
    const r = await fetchFn(photonUrl(q) + extra)
    return r.ok ? ((await r.json()).features || []) : []
  } catch { return [] }
}
const at = f => ({ lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] })
const centres = new WeakMap()                     // per fetch function: city -> its centre (asked once)

async function cityCentre(city, fetchFn) {
  if (!centres.has(fetchFn)) centres.set(fetchFn, new Map())
  const known = centres.get(fetchFn)
  if (!known.has(norm(city))) {
    const [c] = (await features(city, fetchFn, '&osm_tag=place')).filter(f => norm(f.properties?.name) === norm(city))
    known.set(norm(city), c ? at(c) : null)
  }
  return known.get(norm(city))
}

export async function areaSpot(p, fetchFn = fetch) {
  const city = String(p.city || '').trim(), area = String(p.area || '').trim()
  if (!city || !words(area).length) return null
  const centre = await cityCentre(city, fetchFn)
  // the whole landmark first, then each part from the last ("Express Hotel, Alkapuri" -> "Alkapuri")
  const parts = area.split(',').map(s => s.trim()).filter(s => words(s).length)
  for (const part of [...new Set([area, ...parts.reverse()])]) {
    const want = words(part)
    const ok = (await features(`${part}, ${city}`, fetchFn)).filter(f => {
      const name = norm(f.properties?.name)
      if (!name || !want.every(w => hasWord(name, w))) return false
      return centre ? distanceKm(centre, at(f)) <= CITY_KM : norm(f.properties?.city).includes(norm(city))
    })
    const best = ok.find(f => f.properties.osm_key === 'place') || ok[0]   // a real area beats a shop with the same word
    if (best) return { ...at(best), loc_source: 'area' }
  }
  return null
}
