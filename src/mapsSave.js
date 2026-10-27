// maps_url is a new column. Until db/migrations/2026-10-28-maps-url.sql has run (and the Data API
// schema cache is refreshed), the API rejects it: then save everything else instead of failing,
// and say so. run(row) is the insert / update; returns its { data, error }.
export async function skipUnknownMaps(run, row, warn = msg => alert(msg)) {
  const r = await run(row)
  if (!r.error || !('maps_url' in row) || !/maps_url/.test(r.error.message || '')) return r
  const { maps_url, ...rest } = row
  if (maps_url) warn('Saved, but without the Google Maps link: the database needs a one-time update first (db/migrations/2026-10-28-maps-url.sql).')
  return run(rest)
}
