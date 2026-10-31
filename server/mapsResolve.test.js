import { describe, expect, test, vi, afterEach } from 'vitest'
import handler, { allowedStart, allowedHop } from './mapsResolve.js'

const res = () => {
  const r = { code: 200, body: null, headers: {} }
  r.setHeader = (k, v) => { r.headers[k] = v }
  r.status = c => { r.code = c; return r }
  r.json = b => { r.body = b; return r }
  return r
}
const redirect = to => ({ status: 302, headers: { get: k => (k.toLowerCase() === 'location' ? to : null) } })
const final = { status: 200, headers: { get: () => null } }

afterEach(() => vi.unstubAllGlobals())

describe('which links it will open', () => {
  test('starts only from Google short links', () => {
    expect(allowedStart('https://maps.app.goo.gl/abc')).toBe(true)
    expect(allowedStart('https://goo.gl/maps/abc')).toBe(true)
    expect(allowedStart('https://evil.com/x')).toBe(false)
    expect(allowedStart('http://maps.app.goo.gl/a')).toBe(false)
  })
  test('follows only Google hosts', () => {
    expect(allowedHop('https://www.google.co.in/maps/place/X')).toBe(true)
    expect(allowedHop('https://consent.google.com/m?continue=x')).toBe(true)
    expect(allowedHop('https://maps.google.com/?q=1,2')).toBe(true)
    expect(allowedHop('https://evil.com')).toBe(false)
    expect(allowedHop('https://google.com.evil.com/maps')).toBe(false)
    expect(allowedHop('http://www.google.com/maps')).toBe(false)
  })
})

describe('GET /api/maps-resolve', () => {
  test('returns the full Google Maps link the short link leads to', async () => {
    const to = 'https://www.google.com/maps/place/X/@22.3,73.1,17z/data=!3d22.31!4d73.17'
    const fetch = vi.fn().mockResolvedValueOnce(redirect(to)).mockResolvedValue(final)
    vi.stubGlobal('fetch', fetch)
    const r = res()
    await handler({ query: { url: 'https://maps.app.goo.gl/abc' } }, r)
    expect(r.code).toBe(200)
    expect(r.body).toEqual({ url: to })
    expect(fetch).toHaveBeenCalledTimes(1)          // coordinates found: no need to go further
  })

  test('a redirect away from Google is refused', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(redirect('https://evil.com/steal')))
    const r = res()
    await handler({ query: { url: 'https://maps.app.goo.gl/abc' } }, r)
    expect(r.code).toBe(400)
  })

  test('a link that is not a Google short link is refused without fetching', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const r = res()
    await handler({ query: { url: 'https://example.com/a' } }, r)
    expect(r.code).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })
})
