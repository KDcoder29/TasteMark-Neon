// Vercel serverless function: turns "area, city" into lat/lng for the map.
//
// Tries OpenCage first (if OPENCAGE_API_KEY is set), then falls back to OpenStreetMap's
// Nominatim — both server-to-server, so no CORS issues and no key ever reaches the browser.
//
// Why OpenCage: it blends several open datasets (not just OpenStreetMap), so it finds small
// local area/landmark names — common in India — noticeably more often than plain Nominatim
// alone. It needs a free signup (opencagedata.com -> Sign up -> API key), no credit card,
// 2,500 requests/day on the free tier — plenty for a personal journal. Without a key set,
// this still works exactly as before, just with Nominatim's narrower coverage.
//
// Either way, we try a few query variants (exact area+city, a looser version, then just the
// city) before giving up — a pin roughly in the right city beats no pin at all.
const OPENCAGE_KEY = process.env.OPENCAGE_API_KEY

async function lookupOpenCage(q) {
  if (!OPENCAGE_KEY) return null
  const url = `https://api.opencagedata.com/geocode/v1/json?limit=1&no_annotations=1&countrycode=in&key=${OPENCAGE_KEY}&q=${encodeURIComponent(q)}`
  const r = await fetch(url)
  if (!r.ok) return null
  const data = await r.json()
  const hit = data?.results?.[0]
  if (!hit) return null
  if (hit.confidence != null && hit.confidence < 3) return null   // too vague to trust (OpenCage scores 1-10)
  const { lat, lng } = hit.geometry || {}
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

// countrycodes=in is a hard filter (Nominatim's own docs recommend it over stuffing "India"
// into the query text) — it stops an ambiguous local area name from matching something in a
// totally different country and landing the pin somewhere wildly wrong. All of BiteMark's
// places are in India today; if that ever changes, this is the line to relax (on both lookups).
async function lookupNominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`
  const r = await fetch(url, {
    headers: {
      Accept: 'application/json',
      // Nominatim's usage policy asks for a real identifying User-Agent for server-side callers.
      'User-Agent': 'BiteMark-food-journal/1.0 (personal use; hosted on Vercel)',
    },
  })
  if (!r.ok) return null
  const rows = await r.json()
  const hit = rows?.[0]
  if (!hit) return null
  const lat = parseFloat(hit.lat), lng = parseFloat(hit.lon)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { area, city, q } = req.query || {}
  const a = (area || '').trim(), c = (city || '').trim()

  const candidates = [
    q && q.trim(),                                  // caller already built the exact query
    a && c && `${a}, ${c}`,
    a && c && `${a} ${c}`,                           // some area names match better without the comma
    c || a,                                          // last resort: the city center, or bare area if no city
  ].filter(Boolean)

  try {
    for (const query of candidates) {
      const hit = (await lookupOpenCage(query)) || (await lookupNominatim(query))
      if (hit) return res.status(200).json(hit)
    }
    return res.status(200).json({ lat: null, lng: null })
  } catch (e) {
    console.error(e)
    return res.status(200).json({ lat: null, lng: null })   // best-effort: never block a save over this
  }
}
