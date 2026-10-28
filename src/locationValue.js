import { hasCoords, isLocated, isExact, coordsFromMapsUrl, isShortMapsLink } from './geo'

// A form's location value is { lat, lng, loc_source } or null.

// the columns to save: nothing at all when nothing is set and nothing was there (so saving still
// works before the location migration has run), all three null when it was removed
export function locationRow(value, hadBefore) {
  if (hasCoords(value)) return { lat: value.lat, lng: value.lng, loc_source: value.loc_source }
  return hadBefore ? { lat: null, lng: null, loc_source: null } : {}
}

// a pasted Google Maps link -> { lat, lng, loc_source: 'link' }, or null when it has no position.
// Short maps.app.goo.gl links hide it: our own api/maps-resolve opens them (free).
export async function locationFromLink(link, fetchFn = fetch) {
  let url = String(link || '').trim()
  if (!url) return null
  if (!coordsFromMapsUrl(url) && isShortMapsLink(url)) {
    try {
      const r = await fetchFn('/api/maps-resolve?url=' + encodeURIComponent(url))
      if (!r.ok) return null
      url = (await r.json()).url || ''
    } catch { return null }
  }
  const c = coordsFromMapsUrl(url)
  return c ? { ...c, loc_source: 'link' } : null
}

export const locationOf = row => (isLocated(row) ? { lat: row.lat, lng: row.lng, loc_source: row.loc_source ?? null } : null)

// what Fix locations walks through: places, then Want to try entries, with no exact position yet
// (or only an old unchecked guess) that you may edit; .table says where to save each one
export const needsLocation = (places, wishlist, canEdit, canEditWish = canEdit) => [
  ...places.filter(p => !isLocated(p) && canEdit(p)).map(p => ({ ...p, table: 'places' })),
  ...wishlist.filter(w => !isLocated(w) && canEditWish(w)).map(w => ({ ...w, table: 'wishlist' })),
]

// after a save with no exact spot: work out an area-level one from the landmark and city? Only when
// there's a landmark, never over an exact spot, and again only if the landmark or city changed.
const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
export function wantsAreaLookup(loc, before, f) {
  if (isExact(loc) || !String(f.area || '').trim() || !String(f.city || '').trim()) return false
  if (!isLocated(loc)) return true
  return !before || !same(before.area, f.area) || !same(before.city, f.city)
}

// what a form save writes for the location, and whether to look the area up afterwards. A changed
// landmark drops the old area-level position at once (it belonged to the old landmark), so a place
// is never left at the wrong spot when the new landmark can't be found.
export function saveLocation(loc, before, f) {
  const lookup = wantsAreaLookup(loc, before, f)
  const stale = lookup && isLocated(loc) && !isExact(loc)
  return { row: stale ? locationRow(null, true) : locationRow(loc, isLocated(before)), lookup }
}
