import { describe, it, expect } from 'vitest'
import { parseSharedPlace, rankMatches, stashShare, takeShare } from './shareTarget'

const CITIES = ['Vadodara', 'Ahmedabad']
const GOOGLE = 'Raj Rajeshwari Juice Centre\nFatehgunj Main Rd, Fatehgunj, Vadodara, Gujarat 390002\nhttps://maps.app.goo.gl/AbC123'

describe('parseSharedPlace', () => {
  it('reads the format Google Maps shares', () => {
    expect(parseSharedPlace({ text: GOOGLE }, CITIES)).toEqual({
      name: 'Raj Rajeshwari Juice Centre',
      address: 'Fatehgunj Main Rd, Fatehgunj, Vadodara, Gujarat 390002',
      area: 'Fatehgunj', city: 'Vadodara', link: 'https://maps.app.goo.gl/AbC123',
    })
  })
  it('lets the title win as the name', () => {
    expect(parseSharedPlace({ title: 'My Title', text: GOOGLE }, CITIES).name).toBe('My Title')
  })
  it('finds a link that is only in url', () => {
    const r = parseSharedPlace({ title: 'X', text: 'X', url: 'https://maps.app.goo.gl/Zzz9' }, CITIES)
    expect(r.link).toBe('https://maps.app.goo.gl/Zzz9')
  })
  it('works with text only and no link', () => {
    const r = parseSharedPlace({ text: 'Some Cafe\nMain Rd, Vadodara' }, CITIES)
    expect(r.link).toBe('')
    expect(r.name).toBe('Some Cafe')
    expect(r.city).toBe('Vadodara')
  })
  it('leaves city and area empty when no known city is in the address', () => {
    const r = parseSharedPlace({ text: 'Some Cafe\nMain Rd, Surat' }, CITIES)
    expect(r.city).toBe('')
    expect(r.area).toBe('')
  })
})

describe('rankMatches', () => {
  const c = (id, name, city = 'Vadodara') => ({ table: 'places', id, name, city, area: '', loc_source: null, group_id: null })
  const shared = { name: 'Raj Rajeshwari Juice Center', city: 'Vadodara' }
  it('ranks the spelling-tolerant match first and drops weak ones', () => {
    const r = rankMatches(shared, [c(1, 'Coffea'), c(2, 'Raj Rajeshwari Juice Centre'), c(3, 'Other Place')])
    expect(r.map(x => x.id)).toEqual([2])
  })
  it('returns at most 3', () => {
    const many = [1, 2, 3, 4, 5].map(i => c(i, 'Raj Rajeshwari Juice Centre'))
    expect(rankMatches(shared, many)).toHaveLength(3)
  })
  it('puts an exact name in the same city above one in another city', () => {
    const r = rankMatches(shared, [c(1, 'Raj Rajeshwari Juice Center', 'Ahmedabad'), c(2, 'Raj Rajeshwari Juice Center')])
    expect(r.map(x => x.id)).toEqual([2, 1])
  })
})

describe('stashShare / takeShare', () => {
  const mem = () => { const m = {}; return { setItem: (k, v) => { m[k] = v }, getItem: k => m[k] ?? null, removeItem: k => { delete m[k] } } }
  it('round-trips once', () => {
    const s = mem()
    stashShare(s, { title: 'a', text: 'b', url: 'c' })
    expect(takeShare(s)).toEqual({ title: 'a', text: 'b', url: 'c' })
    expect(takeShare(s)).toBeNull()
  })
  it('never throws on blocked storage', () => {
    const bad = { setItem() { throw new Error('x') }, getItem() { throw new Error('x') }, removeItem() { throw new Error('x') } }
    expect(() => stashShare(bad, { a: 1 })).not.toThrow()
    expect(takeShare(bad)).toBeNull()
    expect(takeShare(null)).toBeNull()
  })
})
