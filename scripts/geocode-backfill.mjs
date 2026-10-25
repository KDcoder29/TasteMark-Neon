// One-time job: fills in lat/lng for every place and wishlist item you already have
// (anything saved from now on geocodes itself automatically when you add/edit it).
//
// Tries OpenCage first if OPENCAGE_API_KEY is set (free signup at opencagedata.com, no credit
// card, 2,500 req/day — it blends several datasets and finds small local Indian area names
// noticeably more often than OpenStreetMap alone). Falls back to OpenStreetMap's Nominatim,
// always free, no key. Nominatim's fair-use policy asks for max 1 request/second and a real
// contact in the User-Agent, which is what the pause + header below are for.
//
// Usage (from the project folder, after `npm i pg`):
//   Windows CMD:
//     set NEON_DB_URL=postgresql://neondb_owner:PASSWORD@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
//     set OPENCAGE_API_KEY=your-key-here           (optional, but much better hit rate)
//     node scripts/geocode-backfill.mjs --dry      (shows what WOULD be geocoded; changes nothing)
//     node scripts/geocode-backfill.mjs            (geocodes for real: only rows with no pin yet)
//     node scripts/geocode-backfill.mjs --force    (re-geocodes EVERY row, even ones already pinned —
//                                                    use this once after adding OPENCAGE_API_KEY, so
//                                                    OpenCage can sharpen pins that only got the rough
//                                                    city-center fallback before)
//   macOS/Linux:
//     export NEON_DB_URL=... && export OPENCAGE_API_KEY=... && node scripts/geocode-backfill.mjs
import pg from 'pg'

const { NEON_DB_URL, OPENCAGE_API_KEY } = process.env
if (!NEON_DB_URL) {
  console.error('Set NEON_DB_URL first (Neon Console -> Connect -> pooled connection string).')
  process.exit(1)
}
if (!OPENCAGE_API_KEY) console.log('No OPENCAGE_API_KEY set — using OpenStreetMap only (fine, just narrower coverage).')
const dry = process.argv.includes('--dry')
const force = process.argv.includes('--force')
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function lookupOpenCage(q) {
  if (!OPENCAGE_API_KEY) return null
  const url = `https://api.opencagedata.com/geocode/v1/json?limit=1&no_annotations=1&countrycode=in&key=${OPENCAGE_API_KEY}&q=${encodeURIComponent(q)}`
  const r = await fetch(url)
  if (!r.ok) return null
  const data = await r.json()
  const hit = data?.results?.[0]
  if (!hit || (hit.confidence != null && hit.confidence < 3)) return null
  const { lat, lng } = hit.geometry || {}
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

// countrycodes=in is a hard filter (Nominatim's own docs recommend it over stuffing "India"
// into the query text) — stops an ambiguous area name from matching somewhere in a totally
// different country. All of BiteMark's places are in India today.
async function lookupNominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'BiteMark personal food journal (one-time backfill script)' } })
  await sleep(1100)   // stay under Nominatim's 1 req/sec limit, after every call this makes
  if (!res.ok) return null
  const rows = await res.json()
  const hit = rows?.[0]
  if (!hit) return null
  const lat = parseFloat(hit.lat), lng = parseFloat(hit.lon)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

// try OpenCage then Nominatim, and try the exact spot, a looser version, then just the city —
// a pin roughly in the right city beats no pin at all.
async function geocode(area, city) {
  const candidates = [
    area && city && `${area}, ${city}`,
    area && city && `${area} ${city}`,
    city || area,
  ].filter(Boolean)
  for (const q of candidates) {
    const hit = (await lookupOpenCage(q)) || (await lookupNominatim(q))
    if (hit) return hit
  }
  return null
}

const client = new pg.Client({ connectionString: NEON_DB_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

try {
  let ok = 0, missed = 0
  for (const table of ['places', 'wishlist']) {
    const { rows } = await client.query(
      force
        ? `select id, name, city, area from public.${table} order by created_at`
        : `select id, name, city, area from public.${table} where lat is null order by created_at`
    )
    console.log(`\n${table}: ${rows.length} ${force ? 'total (re-geocoding all)' : 'without coordinates'}`)
    for (const r of rows) {
      const address = [r.area, r.city].filter(Boolean).join(', ') || r.name
      const hit = await geocode(r.area, r.city)
      if (hit) {
        console.log(`  ✓ ${r.name} (${address}) -> ${hit.lat.toFixed(4)}, ${hit.lng.toFixed(4)}`)
        if (!dry) await client.query(`update public.${table} set lat = $1, lng = $2 where id = $3`, [hit.lat, hit.lng, r.id])
        ok++
      } else {
        console.log(`  ✗ ${r.name} (${address}) -> no match, left blank`)
        missed++
      }
    }
  }
  console.log(`\n${dry ? 'DRY RUN — nothing was saved. ' : ''}Done: ${ok} geocoded, ${missed} left blank (edit those places with a clearer area/city and they'll geocode automatically).`)
} finally {
  await client.end()
}
