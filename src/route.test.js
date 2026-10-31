import { describe, it, expect, vi, beforeEach } from 'vitest'
import { routeUrl, parseRoute, walkMinutes, tripLabel, getRoute, clearRouteCache } from './route'

const OK = { code: 'Ok', routes: [{ distance: 3280.1, duration: 198.5, geometry: { coordinates: [[73.18, 22.31], [73.19, 22.32]] } }] }
const okFetch = () => vi.fn(async () => ({ ok: true, json: async () => OK }))
const A = { lat: 22.3115, lng: 73.18 }
const B = { lat: 22.33, lng: 73.2 }

describe('routeUrl', () => {
  it('puts lng before lat', () => {
    expect(routeUrl(A, B)).toBe('https://router.project-osrm.org/route/v1/driving/73.18,22.3115;73.2,22.33?overview=full&geometries=geojson')
  })
})

describe('parseRoute', () => {
  it('reads km, minutes and a [lat,lng] line', () => {
    expect(parseRoute(OK)).toEqual({ km: 3.2801, min: 3, line: [[22.31, 73.18], [22.32, 73.19]] })
  })
  it('gives null unless Ok', () => {
    expect(parseRoute({ code: 'NoRoute', routes: [] })).toBeNull()
    expect(parseRoute(null)).toBeNull()
  })
  it('never says less than 1 minute', () => {
    expect(parseRoute({ code: 'Ok', routes: [{ distance: 50, duration: 5, geometry: { coordinates: [] } }] }).min).toBe(1)
  })
})

describe('walkMinutes', () => {
  it('walks at 4.8 km/h', () => { expect(walkMinutes(2.4)).toBe(30); expect(walkMinutes(0.01)).toBe(1) })
})

describe('tripLabel', () => {
  it('reads km and minutes', () => { expect(tripLabel({ km: 3.8, min: 14 })).toBe('14 min drive · 3.8 km by road') })
  it('uses metres under 1 km', () => { expect(tripLabel({ km: 0.85, min: 2 })).toBe('2 min drive · 850 m by road') })
  it('marks approx', () => { expect(tripLabel({ km: 3.8, min: 14 }, true)).toBe('≈ 14 min drive · 3.8 km by road') })
})

describe('getRoute', () => {
  beforeEach(() => clearRouteCache())
  it('caches for 10 minutes', async () => {
    const f = okFetch(); let t = 1000
    const now = () => t
    const r = await getRoute(A, B, { fetchFn: f, now })
    expect(r.min).toBe(3)
    t += 9 * 60000
    await getRoute({ lat: 22.31149, lng: 73.18 }, B, { fetchFn: f, now })
    expect(f).toHaveBeenCalledTimes(1)
  })
  it('fetches again after 11 minutes', async () => {
    const f = okFetch(); let t = 1000
    const now = () => t
    await getRoute(A, B, { fetchFn: f, now })
    t += 11 * 60000
    await getRoute(A, B, { fetchFn: f, now })
    expect(f).toHaveBeenCalledTimes(2)
  })
  it('gives null on a throwing fetch, a bad status or a non-Ok answer', async () => {
    expect(await getRoute(A, B, { fetchFn: async () => { throw new Error('offline') } })).toBeNull()
    expect(await getRoute(A, B, { fetchFn: async () => ({ ok: false }) })).toBeNull()
    expect(await getRoute(A, B, { fetchFn: async () => ({ ok: true, json: async () => ({ code: 'NoRoute' }) }) })).toBeNull()
  })
})
