// Vercel serverless function: opens a short Google Maps link (maps.app.goo.gl/…) and returns the
// full link it leads to, which has the place's latitude/longitude in it. Browsers can't do this
// themselves (the redirect isn't readable across sites). Free: no API key, no Google API.
// Only Google short links are accepted and only Google pages are followed, so this can't be used
// to fetch anything else.
//   GET /api/maps-resolve?url=https://maps.app.goo.gl/abc  ->  { url: "https://www.google.com/maps/place/…" }
import { coordsFromMapsUrl, isShortMapsLink } from '../src/geo.js'

const HOPS = 5
const GOOGLE = /^(?:[a-z0-9-]+\.)*google\.[a-z]{2,3}(?:\.[a-z]{2})?$/

export const allowedStart = url => isShortMapsLink(url)

export function allowedHop(url) {
  try {
    const u = new URL(url)
    const h = u.hostname.toLowerCase()
    return u.protocol === 'https:' && (GOOGLE.test(h) || h === 'goo.gl' || h === 'maps.app.goo.gl')
  } catch { return false }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const start = String(req.query?.url || '')
  if (!allowedStart(start)) return res.status(400).json({ error: 'Not a Google Maps short link' })
  let url = start
  try {
    for (let i = 0; i < HOPS && !coordsFromMapsUrl(url); i++) {
      const r = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (BiteMark link reader)' } })
      const loc = r.status >= 300 && r.status < 400 ? r.headers.get('location') : null
      if (!loc) break
      const next = new URL(loc, url).toString()
      if (!allowedHop(next)) return res.status(400).json({ error: 'That link leads outside Google Maps' })
      url = next
    }
  } catch (e) {
    console.error(e)
    return res.status(502).json({ error: 'Could not open the link' })
  }
  return res.status(200).json({ url })
}
