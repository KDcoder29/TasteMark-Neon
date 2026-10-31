import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CRAWL_MIN, CRAWL_MAX, crawlStops, tripServiceUrl, parseTrip, googleDirectionsUrl, getTrip, clearTripCache } from './crawl'

const S = (id, lat, lng, extra = {}) => ({ id, name: 'P' + id, area: 'Alkapuri', city: 'Vadodara', lat, lng, loc_source: 'gps', ...extra })
const a = S(1, 22.31, 73.18), b = S(2, 22.32, 73.19), c = S(3, 22.33, 73.2)
const me = { lat: 22.3, lng: 73.17 }

describe('crawlStops', () => {
  it('limits are 2 and 8', () => { expect([CRAWL_MIN, CRAWL_MAX]).toEqual([2, 8]) })
  it('drops unlocated items and caps at 8', () => {
    const many = Array.from({ length: 10 }, (_, i) => S(i, 22 + i / 100, 73))
    expect(crawlStops([...many, { id: 99, name: 'x' }])).toHaveLength(8)
    expect(crawlStops([a, { id: 99, name: 'x' }])).toEqual([a])
  })
})

describe('tripServiceUrl', () => {
  it('starts at you, lng before lat', () => {
    expect(tripServiceUrl(me, [a, b])).toBe('https://router.project-osrm.org/trip/v1/driving/73.17,22.3;73.18,22.31;73.19,22.32?roundtrip=false&source=first&destination=any&overview=full&geometries=geojson')
  })
  it('without you, the first stop is the source', () => {
    expect(tripServiceUrl(null, [a, b])).toBe('https://router.project-osrm.org/trip/v1/driving/73.18,22.31;73.19,22.32?roundtrip=false&source=first&destination=any&overview=full&geometries=geojson')
  })
})

const trip = idx => ({ code: 'Ok', waypoints: idx.map(i => ({ waypoint_index: i })), trips: [{ distance: 11300, duration: 2520, geometry: { coordinates: [[73.17, 22.3], [73.2, 22.33]] } }] })

describe('parseTrip', () => {
  it('reorders the stops by waypoint_index, dropping your start', () => {
    const r = parseTrip(trip([0, 2, 1, 3]), [a, b, c], true)
    expect(r.order.map(s => s.id)).toEqual([2, 1, 3])
    expect(r.km).toBeCloseTo(11.3)
    expect(r.min).toBe(42)
    expect(r.line).toEqual([[22.3, 73.17], [22.33, 73.2]])
  })
  it('works without a start', () => {
    expect(parseTrip(trip([1, 0, 2]), [a, b, c], false).order.map(s => s.id)).toEqual([2, 1, 3])
  })
  it('gives null unless Ok and complete', () => {
    expect(parseTrip({ code: 'NoTrips' }, [a, b], false)).toBeNull()
    expect(parseTrip(null, [a, b], false)).toBeNull()
    expect(parseTrip(trip([0]), [a, b], false)).toBeNull()
  })
})

describe('googleDirectionsUrl', () => {
  it('uses coordinates for exact stops, text for ≈ ones, last stop as destination', () => {
    const v = S(4, 22.4, 73.3, { loc_source: 'area' })
    const u = googleDirectionsUrl(me, [a, v, c])
    expect(u).toBe('https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=22.3,73.17&destination=22.33,73.2&waypoints=22.31,73.18%7C' + encodeURIComponent('P4, Alkapuri, Vadodara'))
  })
  it('has no origin without you, and no waypoints for two stops', () => {
    expect(googleDirectionsUrl(null, [a, b])).toBe('https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=22.32,73.19&waypoints=22.31,73.18')
  })
  it('gives null under 2 stops', () => { expect(googleDirectionsUrl(me, [a])).toBeNull() })
})

describe('getTrip', () => {
  beforeEach(() => clearTripCache())
  const okFetch = () => vi.fn(async () => ({ ok: true, json: async () => trip([0, 1, 2]) }))
  it('gives null under 2 stops without fetching', async () => {
    const f = okFetch()
    expect(await getTrip(me, [a], { fetchFn: f })).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })
  it('caches for 10 minutes, then fetches again', async () => {
    const f = okFetch(); let t = 1000
    const now = () => t
    const r = await getTrip(me, [a, b], { fetchFn: f, now })
    expect(r.order.map(s => s.id)).toEqual([1, 2])
    t += 9 * 60000
    await getTrip({ lat: 22.30001, lng: 73.17 }, [a, b], { fetchFn: f, now })
    expect(f).toHaveBeenCalledTimes(1)
    t += 2 * 60000
    await getTrip(me, [a, b], { fetchFn: f, now })
    expect(f).toHaveBeenCalledTimes(2)
  })
  it('a different order is a different trip', async () => {
    const f = okFetch()
    await getTrip(me, [a, b], { fetchFn: f }); await getTrip(me, [b, a], { fetchFn: f })
    expect(f).toHaveBeenCalledTimes(2)
  })
  it('gives null on failures and does not cache them', async () => {
    expect(await getTrip(me, [a, b], { fetchFn: async () => { throw new Error('offline') } })).toBeNull()
    expect(await getTrip(me, [a, b], { fetchFn: async () => ({ ok: false }) })).toBeNull()
    const f = okFetch()
    expect(await getTrip(me, [a, b], { fetchFn: f })).not.toBeNull()
    expect(f).toHaveBeenCalledTimes(1)
  })
})
