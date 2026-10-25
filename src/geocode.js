// Turns "area, city" into lat/lng, for free, via our own /api/geocode function (which calls
// OpenStreetMap's Nominatim geocoder server-side — no API key, no billing account, and it
// avoids Nominatim's CORS support being inconsistent for calls made directly from the browser).

// Best-effort: returns { lat, lng } or null. Never throws — a failed/slow lookup
// should never stop someone from saving a place.
// area/city/name go to the server as separate fields so it can fall back through a few
// query variants — OpenStreetMap's data often doesn't have small local area/landmark names in
// India, so if the precise spot isn't found it falls back to the city center rather than no pin.
export async function geocode({ area, city, name } = {}) {
  const params = new URLSearchParams()
  if (area) params.set('area', area)
  if (city) params.set('city', city)
  if (!area && !city && name) params.set('area', name)
  if (![...params.keys()].length) return null
  try {
    const res = await fetch(`/api/geocode?${params}`)
    if (!res.ok) return null
    const { lat, lng } = await res.json()
    return lat != null && lng != null ? { lat, lng } : null
  } catch {
    return null   // offline, or the lookup briefly failed — just skip the pin
  }
}

// Builds the address string we geocode from a place/wishlist record.
export const addressOf = p => [p.area, p.city].filter(Boolean).join(', ')

// Straight-line distance between two {lat,lng} points, in km (haversine).
export function distanceKm(a, b) {
  const R = 6371, rad = d => d * Math.PI / 180
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
