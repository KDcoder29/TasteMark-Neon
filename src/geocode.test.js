import { describe, expect, test, vi } from 'vitest'
import { photonUrl, parsePhoton, searchPlaces, guessQuery, fallbackQueries, guessSpot, areaSpot } from './geocode'

const sample = { features: [
  { geometry: { coordinates: [73.17, 22.31] }, properties: { name: 'Mandap', street: 'R C Dutt Road', city: 'Vadodara', state: 'Gujarat' } },
  { geometry: { coordinates: [72.57, 23.02] }, properties: { name: 'Ahmedabad', city: 'Ahmedabad', state: 'Gujarat' } },
] }

describe('Photon search (free OpenStreetMap geocoder)', () => {
  test('url with the query, 5 results, English, and an optional nearby bias', () => {
    expect(photonUrl('Mandap Vadodara')).toBe('https://photon.komoot.io/api/?q=Mandap%20Vadodara&limit=5&lang=en')
    expect(photonUrl('x y', { lat: 22.3, lng: 73.1 })).toBe('https://photon.komoot.io/api/?q=x%20y&limit=5&lang=en&lat=22.3&lon=73.1')
  })
  test('GeoJSON [lng, lat] becomes { lat, lng } with a readable label (no repeats)', () => {
    expect(parsePhoton(sample)).toEqual([
      { label: 'Mandap, R C Dutt Road, Vadodara, Gujarat', lat: 22.31, lng: 73.17 },
      { label: 'Ahmedabad, Gujarat', lat: 23.02, lng: 72.57 },
    ])
    expect(parsePhoton(null)).toEqual([])
  })
  test('short queries do not search', async () => {
    const f = vi.fn()
    expect(await searchPlaces('ab', null, f)).toEqual([])
    expect(f).not.toHaveBeenCalled()
  })
  test('a network error gives no results instead of throwing', async () => {
    expect(await searchPlaces('Mandap', null, async () => { throw new Error('offline') })).toEqual([])
  })
  test('results come back parsed', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => sample }))
    expect((await searchPlaces('Mandap', null, f))[0].lat).toBe(22.31)
  })
})

describe('guessing where an old place is', () => {
  test('name, area and city', () => {
    expect(guessQuery({ name: 'Mandap', area: 'Alkapuri', city: 'Vadodara' })).toBe('Mandap, Alkapuri, Vadodara')
    expect(guessQuery({ name: 'Mandap', city: 'Vadodara' })).toBe('Mandap, Vadodara')
  })
  test('then the area, then the city: blanks and repeats removed', () => {
    expect(fallbackQueries({ name: 'Mandap', area: 'Alkapuri', city: 'Vadodara' })).toEqual(['Mandap, Alkapuri, Vadodara', 'Alkapuri, Vadodara', 'Vadodara'])
    expect(fallbackQueries({ name: 'Mandap', area: '', city: 'Vadodara' })).toEqual(['Mandap, Vadodara', 'Vadodara'])
    expect(fallbackQueries({ name: 'Mandap' })).toEqual(['Mandap'])
  })
})

describe('guessSpot (where the pin starts for a place with no position)', () => {
  const hit = (lat, lng) => ({ ok: true, json: async () => ({ features: [{ geometry: { coordinates: [lng, lat] }, properties: { name: 'Mandap' } }] }) })
  const none = { ok: true, json: async () => ({ features: [] }) }
  test('the place itself: close zoom, marked as found', async () => {
    const f = vi.fn(async () => hit(22.31, 73.17))
    expect(await guessSpot({ name: 'Mandap', area: 'Alkapuri', city: 'Vadodara' }, f)).toEqual({ lat: 22.31, lng: 73.17, zoom: 17, found: 'place' })
    expect(f).toHaveBeenCalledTimes(1)
  })
  test('not found: falls back to the area, then the city, zooming out', async () => {
    const f = vi.fn().mockResolvedValueOnce(none).mockResolvedValueOnce(none).mockResolvedValueOnce(hit(22.3, 73.18))
    expect(await guessSpot({ name: 'Mandap', area: 'Alkapuri', city: 'Vadodara' }, f)).toEqual({ lat: 22.3, lng: 73.18, zoom: 12, found: 'city' })
  })
  test('a result with a different name is not "the place": fall back to the area', async () => {
    const named = (name, lat, lng) => ({ ok: true, json: async () => ({ features: [{ geometry: { coordinates: [lng, lat] }, properties: { name } }] }) })
    const f = vi.fn().mockResolvedValueOnce(named('Hampton by Hilton Vadodara-Alkapuri', 22.312, 73.168)).mockResolvedValueOnce(named('Alkapuri', 22.31, 73.17))
    expect(await guessSpot({ name: 'Mandap', area: 'Alkapuri', city: 'Vadodara' }, f)).toEqual({ lat: 22.31, lng: 73.17, zoom: 15, found: 'area' })
  })
  test('same name, different case or extra words, counts as the place', async () => {
    const named = { ok: true, json: async () => ({ features: [{ geometry: { coordinates: [73.17, 22.31] }, properties: { name: 'MANDAP Restaurant' } }] }) }
    expect((await guessSpot({ name: 'Mandap', city: 'Vadodara' }, async () => named)).found).toBe('place')
  })
  test('no name: starts at the area (zoom 15), never claims to have found "the place"', async () => {
    const f = vi.fn(async () => hit(22.31, 73.17))
    expect(await guessSpot({ area: 'Alkapuri', city: 'Vadodara' }, f)).toEqual({ lat: 22.31, lng: 73.17, zoom: 15, found: 'area' })
  })
  test('nothing at all: null', async () => {
    expect(await guessSpot({ name: 'Zzz' }, async () => none)).toBe(null)
  })
})

describe('areaSpot (automatic, area-level position from the landmark and city)', () => {
  const feat = (name, lat, lng, key = 'place', city = '') => ({ geometry: { coordinates: [lng, lat] }, properties: { name, osm_key: key, city } })
  // fake Photon: answers by the query text
  const photon = table => async url => {
    const q = decodeURIComponent(url.match(/q=([^&]*)/)[1])
    return { ok: true, json: async () => ({ features: table[q] || [] }) }
  }
  const AHMEDABAD = { 'Ahmedabad': [feat('Ahmedabad', 23.0225, 72.5714)] }
  const VADODARA = { 'Vadodara': [feat('Vadodara', 22.3072, 73.1812)] }

  test('the landmark itself, preferring a real area over a shop with the same word', async () => {
    const f = photon({ ...AHMEDABAD, 'Navrangpura, Ahmedabad': [feat('BSNL Navrangpura', 23.0318, 72.5592, 'amenity'), feat('Navrangpura', 23.036, 72.5643)] })
    expect(await areaSpot({ name: 'Unlocked', area: 'Navrangpura', city: 'Ahmedabad' }, f)).toEqual({ lat: 23.036, lng: 72.5643, loc_source: 'area' })
  })
  test('"Express Hotel, Alkapuri": a different hotel is refused, the area after the comma is used', async () => {
    const f = photon({ ...VADODARA,
      'Express Hotel, Alkapuri, Vadodara': [feat('The Fern - An Ecotel Hotel', 22.3028, 73.1776, 'tourism')],
      'Alkapuri, Vadodara': [feat('Alkapuri', 22.3102, 73.1757)] })
    expect(await areaSpot({ name: 'Mandap', area: 'Express Hotel, Alkapuri', city: 'Vadodara' }, f)).toEqual({ lat: 22.3102, lng: 73.1757, loc_source: 'area' })
  })
  test('a same-named place in another city is refused (Race Course Circle in Rajkot)', async () => {
    const f = photon({ ...VADODARA, 'Race Course Circle, Vadodara': [feat('Race Course Circle', 22.2977, 70.7873, 'highway', 'Rajkot')] })
    expect(await areaSpot({ name: 'Sankalp', area: 'Race Course Circle', city: 'Vadodara' }, f)).toBe(null)
  })
  test('no landmark, or nothing found: no position (never the bare city centre)', async () => {
    expect(await areaSpot({ name: 'X', area: '', city: 'Vadodara' }, photon(VADODARA))).toBe(null)
    expect(await areaSpot({ name: 'X', area: 'Sayajigunj', city: 'Vadodara' }, photon(VADODARA))).toBe(null)
  })
  test('numbers and short words count: "TP 13 Canal Road" / "13 Canal Rd" never land on another canal road', async () => {
    const f = photon({ ...VADODARA,
      'TP 13 Canal Road, Vadodara': [feat('Ankodiya Canal Rd', 22.3371, 73.1316, 'highway', 'Vadodara')],
      '13 Canal Rd, Vadodara': [feat('Ankodiya Canal Rd', 22.3371, 73.1316, 'highway', 'Vadodara')] })
    expect(await areaSpot({ name: 'Coffea', area: 'TP 13 Canal Road', city: 'Vadodara' }, f)).toBe(null)
    expect(await areaSpot({ name: 'Coffea', area: '13 Canal Rd', city: 'Vadodara' }, f)).toBe(null)
  })
  test('the same words still match ("Road"/"Rd" and "of" do not matter)', async () => {
    const f = photon({ ...AHMEDABAD, 'House of MG, Lal Darwaja, Ahmedabad': [], 'Lal Darwaja, Ahmedabad': [feat('Lal Darwaja', 23.0242, 72.5786)] })
    expect(await areaSpot({ name: 'Agashiye', area: 'House of MG, Lal Darwaja', city: 'Ahmedabad' }, f)).toEqual({ lat: 23.0242, lng: 72.5786, loc_source: 'area' })
  })
  test('offline: null, never an error', async () => {
    expect(await areaSpot({ name: 'X', area: 'Alkapuri', city: 'Vadodara' }, async () => { throw new Error('offline') })).toBe(null)
  })

  // a fake that answers Photon and Nominatim (the second free OpenStreetMap search) by query text
  const both = (ph, nom = {}) => async url => {
    const q = decodeURIComponent(url.match(/q=([^&]*)/)[1]).replace(/\+/g, ' ')
    if (url.includes('nominatim')) return { ok: true, json: async () => nom[q] || [] }
    return { ok: true, json: async () => ({ features: ph[q] || [] }) }
  }
  const nomHit = (name, lat, lon, address = {}, category = 'amenity') => ({ name, lat: String(lat), lon: String(lon), category, address })
  const NOW = { gap: 0 }

  test('"Alkapuri/Ellora Park": a slash separates places like a comma', async () => {
    const f = both({ ...VADODARA, 'Ellora Park, Vadodara': [feat('Ellora Park', 22.3188, 73.1574)] })
    expect(await areaSpot({ name: 'Kwality', area: 'Alkapuri/Ellora Park', city: 'Vadodara' }, f, NOW)).toEqual({ lat: 22.3188, lng: 73.1574, loc_source: 'area' })
  })
  test('"Kalasagar Mall Ghatlodiya": the area word at the end is used when the whole is unknown', async () => {
    const f = both({ ...AHMEDABAD, 'Ghatlodiya, Ahmedabad': [feat('Ghatlodiya Lake', 23.07, 72.54, 'water'), feat('Ghatlodiya', 23.0657, 72.5383)] })
    expect(await areaSpot({ name: 'Honest', area: 'Kalasagar Mall Ghatlodiya', city: 'Ahmedabad' }, f, NOW)).toEqual({ lat: 23.0657, lng: 72.5383, loc_source: 'area' })
  })
  test('the end word alone must be a real area with exactly that name (no shop, no lake)', async () => {
    const f = both({ ...AHMEDABAD, 'Ghatlodiya, Ahmedabad': [feat('Ghatlodiya Lake', 23.07, 72.54, 'water')] })
    expect(await areaSpot({ name: 'Honest', area: 'Kalasagar Mall Ghatlodiya', city: 'Ahmedabad' }, f, NOW)).toBe(null)
  })
  test('Nominatim is asked when Photon has nothing; its address must name the area', async () => {
    const f = both(VADODARA, { 'Chhani, Vadodara': [nomHit('Indian Oil', 22.3626, 73.1713, { house_number: 'Dhumal, Chhani' })] })
    expect(await areaSpot({ name: 'Ganesh', area: 'Chhani', city: 'Vadodara' }, f, NOW)).toEqual({ lat: 22.3626, lng: 73.1713, loc_source: 'area' })
  })
  test('a Nominatim answer that does not name the area, or is far from the city, is refused', async () => {
    const f = both(VADODARA, {
      'Chhani, Vadodara': [nomHit('Vadodara', 22.2973, 73.1943, {}, 'place')],
      'Mandvi, Vadodara': [nomHit('Mandvi', 22.83, 69.35, { suburb: 'Mandvi' }, 'place')],   // Mandvi in Kutch
    })
    expect(await areaSpot({ name: 'X', area: 'Chhani', city: 'Vadodara' }, f, NOW)).toBe(null)
    expect(await areaSpot({ name: 'X', area: 'Mandvi', city: 'Vadodara' }, f, NOW)).toBe(null)
  })
  test('"Fatehganj" is also looked up as OpenStreetMap spells it ("Fatehgunj")', async () => {
    const f = both(VADODARA, { 'Fatehgunj, Vadodara': [nomHit('Indian Oil', 22.3239, 73.1885, { house_number: 'Fatehgunj', suburb: 'Alkapuri' })] })
    expect(await areaSpot({ name: 'Raj Rajeshwari Juice Centre', area: 'Fatehganj', city: 'Vadodara' }, f, NOW)).toEqual({ lat: 22.3239, lng: 73.1885, loc_source: 'area' })
  })
  test('Nominatim is asked at most 3 times for one place (fair use)', async () => {
    let asked = 0
    const f = async url => { if (url.includes('nominatim')) asked++; return both(VADODARA)(url) }
    await areaSpot({ name: 'X', area: 'Neptune Trion, Sarabhai Campus, Fatehganj Main Road', city: 'Vadodara' }, f, NOW)
    expect(asked).toBeLessThanOrEqual(3)
  })
})
