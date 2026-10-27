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
