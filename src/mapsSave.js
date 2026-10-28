import { showAlert } from './dialogs'
// maps_url and lat / lng / loc_source are newer columns. Until their migrations have run
// (db/migrations/2026-10-28-maps-url.sql, 2026-10-30-place-location.sql) and the Data API schema
// cache is refreshed, the API rejects them: then save everything else instead of failing, and say
// so. run(row) is the insert / update; returns its { data, error }.
const OPTIONAL = [
  { cols: ['maps_url'], test: /maps_url/, title: 'Saved without the map link',
    msg: 'Everything else was saved. The Google Maps link needs a small one-time update on the server first; Maps will search the name and area until then.' },
  { cols: ['lat', 'lng', 'loc_source'], test: /\b(lat|lng|loc_source)\b/, title: 'Saved without the exact location',
    msg: 'Everything else was saved. The exact location needs a small one-time update on the server first.' },
]

export async function skipUnknownMaps(run, row, warn) {
  let r = await run(row)
  for (let tries = 0; r.error && tries < OPTIONAL.length; tries++) {
    const opt = OPTIONAL.find(o => o.cols.some(c => c in row) && o.test.test(r.error.message || ''))
    if (!opt) break
    const had = opt.cols.some(c => row[c] != null)
    row = Object.fromEntries(Object.entries(row).filter(([k]) => !opt.cols.includes(k)))
    // (for the developer: run the migration above in Neon)
    if (had) (warn || (msg => showAlert({ title: opt.title, message: msg, tone: 'info' })))(opt.msg)
    r = await run(row)
  }
  return r
}
