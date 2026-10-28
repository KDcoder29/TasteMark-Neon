import { describe, expect, test } from 'vitest'
import { getPosition, GOOD_ACCURACY } from './locate'

const geoWith = (ok, err) => ({ getCurrentPosition: (s, f, opts) => { geoWith.opts = opts; ok ? s(ok) : f(err) } })

describe('getPosition (the phone GPS, one reading)', () => {
  test('lat, lng and accuracy in metres; asks for high accuracy and a fresh fix', async () => {
    const p = await getPosition({ geo: geoWith({ coords: { latitude: 22.31, longitude: 73.17, accuracy: 8 } }) })
    expect(p).toEqual({ lat: 22.31, lng: 73.17, acc: 8 })
    expect(geoWith.opts).toEqual({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  })
  test('permission refused -> denied', async () => {
    await expect(getPosition({ geo: geoWith(null, { code: 1 }) })).rejects.toMatchObject({ code: 'denied' })
  })
  test('no signal -> unavailable; too slow -> timeout', async () => {
    await expect(getPosition({ geo: geoWith(null, { code: 2 }) })).rejects.toMatchObject({ code: 'unavailable' })
    await expect(getPosition({ geo: geoWith(null, { code: 3 }) })).rejects.toMatchObject({ code: 'timeout' })
  })
  test('no GPS in this browser -> unsupported', async () => {
    await expect(getPosition({ geo: null })).rejects.toMatchObject({ code: 'unsupported' })
  })
  test('a good reading is 50 m or better', () => expect(GOOD_ACCURACY).toBe(50))
})
