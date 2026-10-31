import { findMapsLink } from './mapsLink'
import { fold } from './geocode'

// A place shared from Google Maps (the Android share sheet) arrives as title / text / url.
// Google's text is "Name\nAddress\nhttps://maps.app.goo.gl/…".
const isUrl = s => /^https?:\/\//i.test(s)

export function parseSharedPlace({ title, text, url } = {}, cities = []) {
  const link = findMapsLink(url) || findMapsLink(text) || ''
  const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(s => s && !isUrl(s))
  const name = String(title || '').trim() || lines[0] || ''
  const address = (String(title || '').trim() ? lines.find(l => l !== name) : lines[1]) || ''
  const parts = address.split(',').map(s => s.trim()).filter(Boolean)
  const at = parts.findIndex(p => cities.some(c => c.toLowerCase() === p.toLowerCase()))
  const city = at >= 0 ? cities.find(c => c.toLowerCase() === parts[at].toLowerCase()) : ''
  const area = at > 0 ? parts[at - 1] : ''
  return { name, address, area, city, link }
}

// "Centre" and "Center" should match: fold, then treat a word's ending -re like -er
const words = s => fold(s).split(' ').filter(Boolean).map(w => w.replace(/re$/, 'er'))

// share of matching name words, |A∩B| / max(|A|,|B|)
function similarity(a, b) {
  const A = new Set(words(a)), B = new Set(words(b))
  if (!A.size || !B.size) return 0
  let hit = 0
  for (const w of A) if (B.has(w)) hit++
  return hit / Math.max(A.size, B.size)
}

// the saved places / Want to try entries that this shared place probably is: best first, at most 3
export function rankMatches(shared, candidates) {
  const sameCity = c => (shared.city && c.city && shared.city.toLowerCase() === String(c.city).toLowerCase() ? 0.05 : 0)
  return candidates
    .map(c => ({ c, s: similarity(shared.name, c.name) }))
    .filter(x => x.s >= 0.6)
    .map(x => ({ ...x, rank: x.s + sameCity(x.c) }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 3)
    .map(x => x.c)
}

const KEY = 'bm.share'
export function stashShare(storage, data) {
  try { storage.setItem(KEY, JSON.stringify(data)) } catch {}
}
export function takeShare(storage) {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return null
    storage.removeItem(KEY)
    return JSON.parse(raw)
  } catch { return null }
}
