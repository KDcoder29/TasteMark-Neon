// Exact locations come from Google Maps itself (free, no key): the app opens a Google Maps search for
// the place, you copy its Share link, and the position is read from that link.
import { findMapsLink } from './mapsLink'
import { placeWhere } from './placeView'

// the Google Maps search for name, area and city: the same search that "opens perfectly"
export function findOnGoogleUrl(p) {
  const name = String(p?.name || '').trim()
  if (!name) return null
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([name, placeWhere(p)].filter(Boolean).join(', '))
}

// Has db/migrations/2026-10-30-place-location.sql run? true / false, or null when we can't tell
// (offline…): then nothing is hidden, and a save still falls back safely (mapsSave.js).
export async function checkLocationSupport(client) {
  try {
    const { error } = await client.from('places').select('loc_source').limit(1)
    if (!error) return true
    return /loc_source/.test(error.message || '') ? false : null
  } catch { return null }
}

// "Paste link": the Google Maps link on the clipboard, or why there isn't one
export async function pasteMapsLink(clipboard) {
  let text
  try { text = await clipboard.readText() } catch { return { error: 'blocked' } }
  if (!String(text || '').trim()) return { error: 'empty' }
  const link = findMapsLink(text)
  return link ? { link } : { error: 'not-maps' }
}

// the quiet "N places have no exact location" line in Near me: hidden with × until the number grows
export const showFixHint = (count, hiddenAt) => count > 0 && (hiddenAt == null || count > hiddenAt)
