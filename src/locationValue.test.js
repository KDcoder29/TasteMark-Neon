import { describe, expect, test, vi } from 'vitest'
import { locationRow, locationOf, locationFromLink, needsLocation, wantsAreaLookup, saveLocation } from './locationValue'

describe('locationRow (what a form saves)', () => {
  test('nothing set and nothing before: no columns at all (works before the migration)', () => {
    expect(locationRow(null, false)).toEqual({})
  })
  test('removed: all three cleared', () => {
    expect(locationRow(null, true)).toEqual({ lat: null, lng: null, loc_source: null })
  })
  test('set: lat, lng and how', () => {
    expect(locationRow({ lat: 1, lng: 2, loc_source: 'gps', acc: 8 }, false)).toEqual({ lat: 1, lng: 2, loc_source: 'gps' })
  })
})

describe('locationOf (a saved row -> the form value)', () => {
  test('a row with a position', () => {
    expect(locationOf({ lat: 22.3, lng: 73.1, loc_source: 'pin', name: 'x' })).toEqual({ lat: 22.3, lng: 73.1, loc_source: 'pin' })
  })
  test('no position, or an old unchecked guess: null', () => {
    expect(locationOf({ name: 'x' })).toBe(null)
    expect(locationOf({ lat: 22.3, lng: 73.1, loc_source: null })).toBe(null)
    expect(locationOf(null)).toBe(null)
  })
})

describe('locationFromLink (a pasted Google Maps link -> exact position)', () => {
  test('a full link: read straight from it, no server call', async () => {
    const f = vi.fn()
    expect(await locationFromLink('https://www.google.com/maps/place/X/data=!3d22.31!4d73.17', f)).toEqual({ lat: 22.31, lng: 73.17, loc_source: 'link' })
    expect(f).not.toHaveBeenCalled()
  })
  test('a short link: opened by /api/maps-resolve, then read', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => ({ url: 'https://www.google.com/maps/place/X/@1,2,3z/data=!3d22.31!4d73.17' }) }))
    expect(await locationFromLink('https://maps.app.goo.gl/abc', f)).toEqual({ lat: 22.31, lng: 73.17, loc_source: 'link' })
    expect(f.mock.calls[0][0]).toBe('/api/maps-resolve?url=' + encodeURIComponent('https://maps.app.goo.gl/abc'))
  })
  test('no position in the link, or the server fails: null', async () => {
    expect(await locationFromLink('https://maps.google.com/?cid=1', vi.fn())).toBe(null)
    expect(await locationFromLink('https://maps.app.goo.gl/abc', async () => ({ ok: false, json: async () => ({}) }))).toBe(null)
    expect(await locationFromLink('https://maps.app.goo.gl/abc', async () => { throw new Error('offline') })).toBe(null)
    expect(await locationFromLink('', vi.fn())).toBe(null)
  })
})

describe('needsLocation (what Fix locations walks through)', () => {
  const me = 'me'
  const canEdit = x => x.user_id === me
  test('places and Want to try entries without an exact position, that I can edit; each says which table it is in', () => {
    const places = [
      { id: 'p1', user_id: me, lat: 22.3, lng: 73.1, loc_source: 'pin' },   // done
      { id: 'p2', user_id: me },                                              // needs one
      { id: 'p3', user_id: me, lat: 22.3, lng: 73.1 },                        // old unchecked guess: needs checking
      { id: 'p4', user_id: 'someone' },                                       // not mine to edit
    ]
    const wishes = [{ id: 'w1', user_id: me }, { id: 'w2', user_id: me, lat: 1, lng: 2, loc_source: 'gps' }, { id: 'w3', user_id: 'someone' }]
    expect(needsLocation(places, wishes, canEdit).map(x => `${x.table}:${x.id}`)).toEqual(['places:p2', 'places:p3', 'wishlist:w1'])
  })
})

describe('wantsAreaLookup (after a save: work out an area-level position automatically?)', () => {
  const f = { area: 'Navrangpura', city: 'Ahmedabad' }
  test('nothing set: yes', () => expect(wantsAreaLookup(null, null, f)).toBe(true))
  test('an exact spot (GPS, link, pin): never touched', () => {
    expect(wantsAreaLookup({ lat: 1, lng: 2, loc_source: 'link' }, null, f)).toBe(false)
  })
  test('already area-level: only again when the landmark or city changed', () => {
    const was = { area: 'Navrangpura', city: 'Ahmedabad' }
    const loc = { lat: 1, lng: 2, loc_source: 'area' }
    expect(wantsAreaLookup(loc, was, f)).toBe(false)
    expect(wantsAreaLookup(loc, was, { ...f, area: 'Law Garden' })).toBe(true)
  })
  test('no landmark typed: nothing to look up', () => expect(wantsAreaLookup(null, null, { area: '', city: 'Ahmedabad' })).toBe(false))
})

describe('saveLocation (what a form save writes, and whether to look the area up after)', () => {
  const was = { area: '13 Canal Rd', city: 'Vadodara', lat: 22.337, lng: 73.131, loc_source: 'area' }
  const areaLoc = { lat: 22.337, lng: 73.131, loc_source: 'area' }
  test('landmark changed: the old area-level position is cleared at once, then looked up again', () => {
    expect(saveLocation(areaLoc, was, { area: 'TP 13 Canal Road', city: 'Vadodara' }))
      .toEqual({ row: { lat: null, lng: null, loc_source: null }, lookup: true })
  })
  test('landmark unchanged: kept as it is, no lookup', () => {
    expect(saveLocation(areaLoc, was, { area: '13 Canal Rd', city: 'Vadodara' })).toEqual({ row: areaLoc, lookup: false })
  })
  test('an exact spot is saved as it is, never looked up', () => {
    const exact = { lat: 22.3, lng: 73.1, loc_source: 'link' }
    expect(saveLocation(exact, was, { area: 'TP 13 Canal Road', city: 'Vadodara' })).toEqual({ row: exact, lookup: false })
  })
  test('a new place with nothing set: no columns, then a lookup', () => {
    expect(saveLocation(null, null, { area: 'Navrangpura', city: 'Ahmedabad' })).toEqual({ row: {}, lookup: true })
  })
})
