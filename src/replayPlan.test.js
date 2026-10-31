import { describe, it, expect } from 'vitest'
import { replayFrames, replaySummary } from './replayPlan'

// mid-month dates, so the local month is the same in any timezone
const at = (id, iso, extra = {}) => ({ id, name: 'P' + id, lat: 22.3, lng: 73.1, loc_source: 'gps', created_at: iso, dishes: [], area: '', ...extra })

describe('replayFrames', () => {
  const places = [
    at('a', '2026-01-15T12:00:00Z'),
    at('b', '2026-01-18T12:00:00Z'),
    at('c', '2026-03-15T12:00:00Z'),
  ]
  it('gives one frame per month with cumulative ids and labels', () => {
    const f = replayFrames(places)
    expect(f).toHaveLength(2)
    expect(f[0]).toEqual({ key: '2026-01', label: 'Jan 2026', ids: ['a', 'b'], added: 2 })
    expect(f[1]).toEqual({ key: '2026-03', label: 'Mar 2026', ids: ['a', 'b', 'c'], added: 1 })
  })
  it('sorts by month whatever the input order', () => {
    expect(replayFrames([...places].reverse()).map(f => f.key)).toEqual(['2026-01', '2026-03'])
  })
  it('skips places with no position or a bad date', () => {
    const f = replayFrames([...places, at('d', '2026-05-15T12:00:00Z', { lat: null, lng: null, loc_source: null }), at('e', 'nope'), at('g', null)])
    expect(f).toHaveLength(2)
    expect(f[1].ids).toEqual(['a', 'b', 'c'])
  })
  it('is empty for no places', () => { expect(replayFrames([])).toEqual([]) })
})

describe('replaySummary', () => {
  it('counts places, dishes, distinct areas and the food home', () => {
    const s = replaySummary([
      at('a', '2026-01-15T12:00:00Z', { area: 'Alkapuri', dishes: [{}, {}] }),
      at('b', '2026-01-18T12:00:00Z', { area: 'Express Hotel, Alkapuri', dishes: [{}] }),
      at('c', '2026-03-15T12:00:00Z', { area: 'Fatehgunj', dishes: [] }),
      at('d', '2026-03-16T12:00:00Z', { lat: null, lng: null, loc_source: null, area: 'Gotri', dishes: [{}] }),
    ])
    expect(s).toEqual({ places: 3, dishes: 3, areas: 2, home: { name: 'Alkapuri', count: 2 } })
  })
  it('has no home under two places in one area', () => {
    expect(replaySummary([at('a', '2026-01-15T12:00:00Z', { area: 'X' })]).home).toBeNull()
  })
})
