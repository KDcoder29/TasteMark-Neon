import { describe, expect, test } from 'vitest'
import { nearbyGuess, dismissNudge, nudgeDismissed } from './hereNudge'

const store = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) } }
const me = { lat: 22.3, lng: 73.17, acc: 20 }
const dLat = m => m / 111320                       // metres north of me
const it = (id, m, extra = {}) => ({ kind: 'place', id, lat: me.lat + dLat(m), lng: me.lng, loc_source: 'area', ...extra })

describe('"Are you at …?" picks an area-level place you are standing at', () => {
  test('poor accuracy gives nothing', () => {
    expect(nearbyGuess([it('a', 100)], { ...me, acc: 80 }, new Set())).toBeNull()
  })
  test('300 m is offered, 450 m is not', () => {
    expect(nearbyGuess([it('a', 300)], me, new Set()).id).toBe('a')
    expect(nearbyGuess([it('a', 450)], me, new Set())).toBeNull()
  })
  test('exact places and places without a position are never offered', () => {
    expect(nearbyGuess([it('a', 50, { loc_source: 'gps' }), it('b', 50, { loc_source: 'pin' }), it('c', 50, { lat: null, lng: null })], me, new Set())).toBeNull()
  })
  test('the nearest of two wins', () => {
    expect(nearbyGuess([it('far', 300), it('near', 100)], me, new Set()).id).toBe('near')
  })
  test('a dismissed one is skipped (kind decides the table)', () => {
    expect(nearbyGuess([it('a', 100)], me, new Set(['places:a']))).toBeNull()
    expect(nearbyGuess([it('a', 100, { kind: 'wish' })], me, new Set(['places:a'])).id).toBe('a')
    expect(nearbyGuess([it('a', 100, { kind: 'wish' })], me, new Set(['wishlist:a']))).toBeNull()
  })
  test('no position of yours gives nothing', () => {
    expect(nearbyGuess([it('a', 100)], null, new Set())).toBeNull()
  })
})

describe('dismissed nudges are remembered on this device', () => {
  test('round-trips', () => {
    const s = store()
    dismissNudge(s, 'places:a'); dismissNudge(s, 'wishlist:b')
    expect([...nudgeDismissed(s)].sort()).toEqual(['places:a', 'wishlist:b'])
  })
  test('blocked storage gives an empty set and does not throw', () => {
    const bad = { getItem() { throw new Error('no') }, setItem() { throw new Error('no') } }
    expect(nudgeDismissed(bad).size).toBe(0)
    expect(() => dismissNudge(bad, 'places:a')).not.toThrow()
  })
})
