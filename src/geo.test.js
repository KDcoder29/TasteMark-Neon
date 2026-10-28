import { describe, expect, test } from 'vitest'
import { hasCoords, distanceKm, formatDistance, coordsFromMapsUrl, isShortMapsLink, nearby, directionsUrl, bestRating, pinColor, isLocated, isExact, distanceLabel, sortByDistance, homeCity } from './geo'

const VADODARA = { lat: 22.3072, lng: 73.1812 }
const AHMEDABAD = { lat: 23.0225, lng: 72.5714 }

describe('hasCoords', () => {
  test('both numbers, in range', () => {
    expect(hasCoords({ lat: 22.3, lng: 73.1 })).toBe(true)
    expect(hasCoords({ lat: 0, lng: 0 })).toBe(true)
  })
  test('missing, half, strings or out of range are not a position', () => {
    expect(hasCoords({ lat: 0 })).toBe(false)
    expect(hasCoords({ lat: '22', lng: '73' })).toBe(false)
    expect(hasCoords({ lat: null, lng: null })).toBe(false)
    expect(hasCoords({ lat: 95, lng: 10 })).toBe(false)
    expect(hasCoords({ lat: 10, lng: 181 })).toBe(false)
    expect(hasCoords(null)).toBe(false)
  })
})

describe('distanceKm / formatDistance', () => {
  test('Vadodara to Ahmedabad is about 100 km in a straight line', () => {
    const d = distanceKm(VADODARA, AHMEDABAD)
    expect(d).toBeGreaterThan(100)
    expect(d).toBeLessThan(102)
  })
  test('same point is 0', () => expect(distanceKm(VADODARA, VADODARA)).toBe(0))
  test('metres under 1 km (to 10 m), one decimal under 10 km, whole km after', () => {
    expect(formatDistance(0.8523)).toBe('850 m')
    expect(formatDistance(0.004)).toBe('0 m')
    expect(formatDistance(3.24)).toBe('3.2 km')
    expect(formatDistance(12.6)).toBe('13 km')
  })
})

describe('coordsFromMapsUrl', () => {
  test('the place itself (!3d!4d) wins over the map centre (@)', () => {
    const url = 'https://www.google.com/maps/place/Mandap/@22.31,73.17,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d22.3105!4d73.1702'
    expect(coordsFromMapsUrl(url)).toEqual({ lat: 22.3105, lng: 73.1702 })
  })
  test('q= / query= / ll= / destination= hold lat,lng', () => {
    expect(coordsFromMapsUrl('https://maps.google.com/?q=22.3,73.18')).toEqual({ lat: 22.3, lng: 73.18 })
    expect(coordsFromMapsUrl('https://www.google.com/maps/search/?api=1&query=22.3%2C73.18')).toEqual({ lat: 22.3, lng: 73.18 })
    expect(coordsFromMapsUrl('https://maps.google.com/?ll=-33.86,151.2')).toEqual({ lat: -33.86, lng: 151.2 })
    expect(coordsFromMapsUrl('https://www.google.com/maps/dir/?api=1&destination=22.31,73.17')).toEqual({ lat: 22.31, lng: 73.17 })
  })
  test('/place/lat,lng and plain @lat,lng', () => {
    expect(coordsFromMapsUrl('https://www.google.com/maps/place/22.3106,73.1695')).toEqual({ lat: 22.3106, lng: 73.1695 })
    expect(coordsFromMapsUrl('https://www.google.com/maps/@22.3,73.18,15z')).toEqual({ lat: 22.3, lng: 73.18 })
  })
  test('a link with only a place id has no position', () => {
    expect(coordsFromMapsUrl('https://maps.google.com/?cid=123456')).toBe(null)
    expect(coordsFromMapsUrl('https://www.google.com/maps/place/Mandap/data=!4m2!3m1!1s0x395fc8')).toBe(null)
    expect(coordsFromMapsUrl('https://maps.app.goo.gl/abc123')).toBe(null)
  })
  test('out of range or junk is null', () => {
    expect(coordsFromMapsUrl('https://www.google.com/maps/place/x/data=!3d95!4d10')).toBe(null)
    expect(coordsFromMapsUrl('')).toBe(null)
    expect(coordsFromMapsUrl(null)).toBe(null)
    expect(coordsFromMapsUrl('https://www.google.com/maps/search/?api=1&query=Mandap%2C%20Vadodara')).toBe(null)
  })
})

test('isShortMapsLink: only Google short links', () => {
  expect(isShortMapsLink('https://maps.app.goo.gl/abc')).toBe(true)
  expect(isShortMapsLink('https://goo.gl/maps/abc')).toBe(true)
  expect(isShortMapsLink('https://goo.gl/abc')).toBe(false)
  expect(isShortMapsLink('https://www.google.com/maps/place/x')).toBe(false)
  expect(isShortMapsLink('nonsense')).toBe(false)
})

describe('isLocated: an exact position someone set (GPS, Maps link or pin)', () => {
  test('a position with how it was set counts', () => {
    expect(isLocated({ lat: 22.3, lng: 73.1, loc_source: 'gps' })).toBe(true)
    expect(isLocated({ lat: 22.3, lng: 73.1, loc_source: 'pin' })).toBe(true)
  })
  test('an old automatic guess (no loc_source) does not', () => {
    expect(isLocated({ lat: 22.3, lng: 73.1 })).toBe(false)
    expect(isLocated({ lat: 22.3, lng: 73.1, loc_source: null })).toBe(false)
    expect(isLocated({ lat: 22.3, lng: 73.1, loc_source: 'guess' })).toBe(false)
  })
})

describe('nearby', () => {
  const at = (id, lat, lng) => ({ id, lat, lng, loc_source: 'pin' })
  const items = [
    at('far', 22.40, 73.18),                                     // ~10 km
    at('near', 22.31, 73.18),                                    // ~0.3 km
    { id: 'none' },                                              // no position: never 0,0
    { id: 'half', lat: 22.3, loc_source: 'pin' },
    { id: 'guess', lat: 22.3075, lng: 73.1815 },                 // an old unchecked guess: left out
    at('mid', 22.33, 73.18),                                     // ~2.5 km
  ]
  test('nearest first, with .km, inside the radius only', () => {
    const r = nearby(items, VADODARA, 5)
    expect(r.map(p => p.id)).toEqual(['near', 'mid'])
    expect(r[0].km).toBeLessThan(r[1].km)
  })
  test('places without a position are skipped', () => {
    expect(nearby(items, VADODARA, 100).map(p => p.id)).toEqual(['near', 'mid', 'far'])
  })
})

test('directionsUrl: exact coordinates, or nothing', () => {
  expect(directionsUrl({ lat: 22.31, lng: 73.17, loc_source: 'pin' })).toBe('https://www.google.com/maps/dir/?api=1&destination=22.31,73.17')
  expect(directionsUrl({})).toBe(null)
})

describe('pins coloured by how good the place is', () => {
  test('bestRating: the best dish (group dishes use their average); 0 when unrated', () => {
    expect(bestRating({ dishes: [{ rating: 3 }, { rating: 5 }, { rating: null }] })).toBe(5)
    expect(bestRating({ dishes: [{ avg: 3.5, rating: 3.5 }, { avg: 4.2, rating: 4.2 }] })).toBe(4.2)
    expect(bestRating({ dishes: [] })).toBe(0)
    expect(bestRating({})).toBe(0)
  })
  test('pinColor: 5 green, 4 light green, 3 amber, 2 or less orange-red, unrated grey', () => {
    expect(pinColor(5)).toBe('var(--pri)')
    expect(pinColor(4.2)).toBe('#3b9c74')
    expect(pinColor(3)).toBe('#c9a227')
    expect(pinColor(2)).toBe('#c2410c')
    expect(pinColor(1)).toBe('#c2410c')
    expect(pinColor(0)).toBe('var(--faint)')
  })
})

describe('area-level positions (automatic, from the landmark and city)', () => {
  const area = { name: 'Unlocked', area: 'Navrangpura', city: 'Ahmedabad', lat: 23.036, lng: 72.5643, loc_source: 'area' }
  test('they count for Near me, but are not exact', () => {
    expect(isLocated(area)).toBe(true)
    expect(isExact(area)).toBe(false)
    expect(isExact({ ...area, loc_source: 'link' })).toBe(true)
    expect(isExact({ ...area, loc_source: null })).toBe(false)
  })
  test('Directions: exact spots by coordinates; area-level ones let Google find the place by name', () => {
    expect(directionsUrl({ ...area, loc_source: 'gps' })).toBe('https://www.google.com/maps/dir/?api=1&destination=23.036,72.5643')
    expect(directionsUrl(area)).toBe('https://www.google.com/maps/dir/?api=1&destination=Unlocked%2C%20Navrangpura%2C%20Ahmedabad')
  })
  test('distance label: "≈" for area-level', () => {
    expect(distanceLabel({ ...area, km: 1.24 })).toBe('≈ 1.2 km')
    expect(distanceLabel({ ...area, loc_source: 'pin', km: 0.42 })).toBe('420 m')
  })
})

describe('Near me without a distance limit', () => {
  const at = (id, city, lat, lng) => ({ id, name: id, city, lat, lng, loc_source: 'pin' })
  const items = [at('vad1', 'Vadodara', 22.31, 73.18), at('ahm1', 'Ahmedabad', 23.03, 72.56), at('ahm2', 'Ahmedabad', 23.05, 72.53), { id: 'none', name: 'none', city: 'Ahmedabad' }]
  const ME = { lat: 23.03, lng: 72.57 }      // in Ahmedabad
  test('sortByDistance: every located place, nearest first, however far (Vadodara too)', () => {
    expect(sortByDistance(items, ME).map(p => p.id)).toEqual(['ahm1', 'ahm2', 'vad1'])
    expect(sortByDistance(items, ME).at(-1).km).toBeGreaterThan(90)
  })
  test('without your position: by name, no distances', () => {
    const r = sortByDistance(items, null)
    expect(r.map(p => p.id)).toEqual(['ahm1', 'ahm2', 'vad1'])
    expect(r[0].km).toBeUndefined()
  })
  test('homeCity: the city you are in (its nearest place within 40 km), else none', () => {
    expect(homeCity(items, ME)).toBe('Ahmedabad')
    expect(homeCity(items, { lat: 19.07, lng: 72.88 })).toBe(null)       // Mumbai: none of these is near
    expect(homeCity(items, null)).toBe(null)
  })
})
