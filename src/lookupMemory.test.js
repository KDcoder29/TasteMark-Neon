import { describe, expect, test } from 'vitest'
import { shouldLookup, rememberMiss } from './lookupMemory'

const store = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) } }
const DAY = 864e5
const it = { table: 'places', id: 'p1', area: 'TP 13', city: 'Vadodara' }

describe('area lookups that found nothing are not repeated on every app start', () => {
  test('never tried: look it up', () => {
    expect(shouldLookup(store(), it, 0)).toBe(true)
  })
  test('found nothing: not asked again for 14 days', () => {
    const s = store()
    rememberMiss(s, it, 0)
    expect(shouldLookup(s, it, 13 * DAY)).toBe(false)
    expect(shouldLookup(s, it, 15 * DAY)).toBe(true)
  })
  test('a changed landmark or city is looked up straight away', () => {
    const s = store()
    rememberMiss(s, it, 0)
    expect(shouldLookup(s, { ...it, area: 'Fatehganj' }, DAY)).toBe(true)
    expect(shouldLookup(s, { ...it, city: 'Ahmedabad' }, DAY)).toBe(true)
    expect(shouldLookup(s, { ...it, area: 'tp 13 ' }, DAY)).toBe(false)     // same words, other case
    expect(shouldLookup(s, { ...it, area: 'TP   13' }, DAY)).toBe(false)
  })
  test('another place with the same landmark is its own entry', () => {
    const s = store()
    rememberMiss(s, it, 0)
    expect(shouldLookup(s, { ...it, id: 'p2' }, DAY)).toBe(true)
  })
  test('blocked or broken storage: look it up, never crash', () => {
    const bad = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } }
    expect(shouldLookup(bad, it, 0)).toBe(true)
    expect(() => rememberMiss(bad, it, 0)).not.toThrow()
    const junk = { getItem: () => '{not json', setItem: () => {} }
    expect(shouldLookup(junk, it, 0)).toBe(true)
  })
})
