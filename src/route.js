// Road travel time and route line from the free OSRM demo server (fair use: only after a tap, cached 10 minutes)
const TTL = 10 * 60000
const cache = new Map()

export const clearRouteCache = () => cache.clear() // for tests

export const routeUrl = (from, to) =>
  `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`

export function parseRoute(json) {
  const r = json?.code === 'Ok' ? json.routes?.[0] : null
  if (!r) return null
  return {
    km: r.distance / 1000,
    min: Math.max(1, Math.round(r.duration / 60)),
    line: (r.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]),
  }
}

export const walkMinutes = km => Math.max(1, Math.round(km / 4.8 * 60))

export function tripLabel({ km, min }, approx = false) {
  const far = km < 1 ? `${Math.round(km * 1000)} m` : `${Math.round(km * 10) / 10} km`
  return `${approx ? '≈ ' : ''}${min} min drive · ${far} by road`
}

export async function getRoute(from, to, { fetchFn = fetch, now = Date.now } = {}) {
  const key = `${from.lat.toFixed(3)},${from.lng.toFixed(3)}>${to.lat},${to.lng}`
  const hit = cache.get(key)
  if (hit && now() - hit.at < TTL) return hit.route
  try {
    const res = await fetchFn(routeUrl(from, to))
    if (!res.ok) return null
    const route = parseRoute(await res.json())
    if (route) cache.set(key, { at: now(), route })
    return route
  } catch { return null }
}
