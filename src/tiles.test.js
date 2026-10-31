import { describe, it, expect } from 'vitest'
import { tileSource, OSM_FALLBACK } from './tiles'

describe('tileSource', () => {
  it('light is CARTO Voyager', () => {
    const t = tileSource(false)
    expect(t.url).toBe('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png')
    expect(t.subdomains).toBe('abcd')
  })
  it('dark is CARTO Dark Matter', () => {
    const t = tileSource(true)
    expect(t.url).toBe('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png')
    expect(t.subdomains).toBe('abcd')
  })
  it('credits OpenStreetMap and CARTO, both linked', () => {
    for (const dark of [false, true]) {
      const a = tileSource(dark).attribution
      expect(a).toMatch(/<a [^>]*href="https:\/\/www\.openstreetmap\.org\/copyright"[^>]*>OpenStreetMap<\/a>/)
      expect(a).toMatch(/<a [^>]*href="https:\/\/carto\.com\/attributions"[^>]*>CARTO<\/a>/)
    }
  })
})

describe('OSM_FALLBACK', () => {
  it('is plain OpenStreetMap with its credit', () => {
    expect(OSM_FALLBACK.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png')
    expect(OSM_FALLBACK.attribution).toContain('OpenStreetMap')
    expect(OSM_FALLBACK.attribution).not.toContain('CARTO')
  })
})
