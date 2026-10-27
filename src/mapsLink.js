// "Open in Maps" for any place: the exact Google Maps link you pasted (maps_url), or else a Maps
// search for the name, area and city you typed (free Google "Maps URLs", no API key).
import { placeWhere } from './placeView'

const MAX = 500

// only real Google Maps links are saved or opened
export function isMapsLink(s) {
  if (typeof s !== 'string' || !s || s.length > MAX) return false
  let u
  try { u = new URL(s) } catch { return false }
  if (u.protocol !== 'https:') return false
  const h = u.hostname.toLowerCase(), path = u.pathname
  if (h === 'maps.app.goo.gl') return path.length > 1
  if (h === 'goo.gl') return path.startsWith('/maps')
  if (/^maps\.google\.[a-z.]+$/.test(h)) return true
  return /^(www\.)?google\.[a-z.]+$/.test(h) && path.startsWith('/maps')
}

// the first Google Maps link inside pasted text (a WhatsApp message usually has name + address + link)
export function findMapsLink(text) {
  for (const raw of String(text || '').match(/https?:\/\/[^\s<>"']+/g) || []) {
    const url = raw.replace(/[.,;:!?)\]}]+$/, '')
    if (isMapsLink(url)) return url
  }
  return null
}

// what the Maps button opens; null when there's nothing to look for
export function mapsUrl(p) {
  if (!p) return null
  if (isMapsLink(p.maps_url)) return p.maps_url
  const name = (p.name || '').trim()
  if (!name) return null
  const q = [name, placeWhere(p)].filter(Boolean).join(', ')
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q)
}
