import { describe, expect, test, vi } from 'vitest'
import { skipUnknownMaps } from './mapsSave'

const missing = { message: "Could not find the 'maps_url' column of 'places' in the schema cache" }

describe('skipUnknownMaps (before the maps_url migration has run)', () => {
  test('a normal save goes through once', async () => {
    const run = vi.fn(async () => ({ data: { id: 1 }, error: null }))
    expect(await skipUnknownMaps(run, { name: 'X', maps_url: 'https://maps.app.goo.gl/a' })).toEqual({ data: { id: 1 }, error: null })
    expect(run).toHaveBeenCalledTimes(1)
  })

  test('unknown column: saves again without the link, and says so', async () => {
    const run = vi.fn(async row => ('maps_url' in row ? { error: missing } : { data: { id: 2 }, error: null }))
    const warn = vi.fn()
    const r = await skipUnknownMaps(run, { name: 'X', maps_url: 'https://maps.app.goo.gl/a' }, warn)
    expect(r.data).toEqual({ id: 2 })
    expect(run.mock.calls[1][0]).toEqual({ name: 'X' })
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test('clearing a link (null) on an old database is silent', async () => {
    const run = vi.fn(async row => ('maps_url' in row ? { error: missing } : { error: null }))
    const warn = vi.fn()
    await skipUnknownMaps(run, { name: 'X', maps_url: null }, warn)
    expect(warn).not.toHaveBeenCalled()
  })

  test('other errors are returned as they are, without retrying', async () => {
    const run = vi.fn(async () => ({ error: { message: 'permission denied' } }))
    expect((await skipUnknownMaps(run, { name: 'X', maps_url: null })).error.message).toBe('permission denied')
    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe('skipUnknownMaps (before the place-location migration has run)', () => {
  const noLat = { message: 'column "lat" of relation "places" does not exist' }
  test('unknown lat: saves again without lat, lng and loc_source, and says so once', async () => {
    const run = vi.fn(async row => ('lat' in row ? { error: noLat } : { data: { id: 3 }, error: null }))
    const warn = vi.fn()
    const r = await skipUnknownMaps(run, { name: 'X', lat: 22.3, lng: 73.1, loc_source: 'gps' }, warn)
    expect(r.data).toEqual({ id: 3 })
    expect(run.mock.calls[1][0]).toEqual({ name: 'X' })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toMatch(/location/i)
  })

  test('clearing a location on an old database is silent', async () => {
    const run = vi.fn(async row => ('lat' in row ? { error: noLat } : { error: null }))
    const warn = vi.fn()
    await skipUnknownMaps(run, { name: 'X', lat: null, lng: null, loc_source: null }, warn)
    expect(warn).not.toHaveBeenCalled()
  })

  test('neither new column known: both are dropped, the rest is saved', async () => {
    const run = vi.fn(async row => ('maps_url' in row ? { error: missing } : 'lat' in row ? { error: noLat } : { data: { id: 4 }, error: null }))
    const r = await skipUnknownMaps(run, { name: 'X', maps_url: 'https://maps.app.goo.gl/a', lat: 1, lng: 2, loc_source: 'pin' }, () => {})
    expect(r.data).toEqual({ id: 4 })
    expect(run.mock.calls.at(-1)[0]).toEqual({ name: 'X' })
  })
})
