import { showAlert } from './dialogs'
// maps_url is a new column. Until db/migrations/2026-10-28-maps-url.sql has run (and the Data API
// schema cache is refreshed), the API rejects it: then save everything else instead of failing,
// and say so. run(row) is the insert / update; returns its { data, error }.
export async function skipUnknownMaps(run, row, warn = msg => showAlert({ title: 'Saved without the map link', message: msg, tone: 'info' })) {
  const r = await run(row)
  if (!r.error || !('maps_url' in row) || !/maps_url/.test(r.error.message || '')) return r
  const { maps_url, ...rest } = row
  // (for the developer: run db/migrations/2026-10-28-maps-url.sql in Neon)
  if (maps_url) warn('Everything else was saved. The Google Maps link needs a small one-time update on the server first; Maps will search the name and area until then.')
  return run(rest)
}
