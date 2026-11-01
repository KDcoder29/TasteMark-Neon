import { describe, expect, test } from 'vitest'
import { spaceBase, viewHref, placeHref, parsePath, spaceFromSegments, safeDecode, groupsChangeTarget, currentGroup } from '@/lib/routes'

describe('spaceBase', () => {
  test('Personal is the root, a group lives under /g/<id>', () => {
    expect(spaceBase(null)).toBe('')
    expect(spaceBase(undefined)).toBe('')
    expect(spaceBase('g1')).toBe('/g/g1')
    expect(spaceBase('a b')).toBe('/g/a%20b')            // encoded, symmetric with parsePath's decode
  })
})

describe('viewHref', () => {
  test('Personal journal is /', () => expect(viewHref('journal', null)).toBe('/'))
  test('a group view', () => expect(viewHref('near', 'g1')).toBe('/g/g1/near'))
  test('every view in both spaces', () => {
    expect(viewHref('wishlist', null)).toBe('/want-to-try')
    expect(viewHref('near', null)).toBe('/near')
    expect(viewHref('journal', 'g1')).toBe('/g/g1')
    expect(viewHref('wishlist', 'g1')).toBe('/g/g1/want-to-try')
    expect(viewHref('activity', 'g1')).toBe('/g/g1/activity')
  })
  test('an unknown view falls back to the journal', () => expect(viewHref('nope', 'g1')).toBe('/g/g1'))
})

describe('placeHref', () => {
  test('Personal place', () => expect(placeHref('p9', null)).toBe('/places/p9'))
  test('group place', () => expect(placeHref('p9', 'g1')).toBe('/g/g1/places/p9'))
})

describe('parsePath', () => {
  test('a group place', () => {
    expect(parsePath('/g/g1/places/p9')).toEqual({ groupId: 'g1', view: 'journal', placeId: 'p9', sheet: null })
  })
  test('views', () => {
    expect(parsePath('/want-to-try').view).toBe('wishlist')
    expect(parsePath('/near')).toEqual({ groupId: null, view: 'near', placeId: null, sheet: null })
    expect(parsePath('/g/g1/activity')).toEqual({ groupId: 'g1', view: 'activity', placeId: null, sheet: null })
    expect(parsePath('/g/g1/want-to-try/').view).toBe('wishlist')
    expect(parsePath('/')).toEqual({ groupId: null, view: 'journal', placeId: null, sheet: null })
    expect(parsePath('/places/p9')).toEqual({ groupId: null, view: 'journal', placeId: 'p9', sheet: null })
  })
  test('sheets', () => {
    expect(parsePath('/you').sheet).toBe('you')
    expect(parsePath('/groups').sheet).toBe('groups')
  })
  test('an unknown address is the journal with nulls', () => {
    expect(parsePath('/unknown')).toEqual({ groupId: null, view: 'journal', placeId: null, sheet: null })
    expect(parsePath('')).toEqual({ groupId: null, view: 'journal', placeId: null, sheet: null })
    expect(parsePath(null)).toEqual({ groupId: null, view: 'journal', placeId: null, sheet: null })
  })
  test('ids are decoded', () => expect(parsePath('/g/a%20b').groupId).toBe('a b'))
})

describe('safeDecode', () => {
  test('decodes, and never throws on a malformed %', () => {
    expect(safeDecode('a%20b')).toBe('a b')
    expect(safeDecode('100%')).toBe('100%')
    expect(parsePath('/g/100%').groupId).toBe('100%')
  })
})

// the children slot's selected segments (useSelectedLayoutSegments in the (app) layout): the space
// and view stay those of the page underneath while an intercepted overlay owns the address
describe('spaceFromSegments', () => {
  test('Personal views (route groups are skipped)', () => {
    expect(spaceFromSegments([])).toEqual({ groupId: null, view: 'journal' })
    expect(spaceFromSegments(['(personal)'])).toEqual({ groupId: null, view: 'journal' })
    expect(spaceFromSegments(['(personal)', 'near'])).toEqual({ groupId: null, view: 'near' })
    expect(spaceFromSegments(['(personal)', 'want-to-try'])).toEqual({ groupId: null, view: 'wishlist' })
    expect(spaceFromSegments(['(personal)', 'places', 'p9'])).toEqual({ groupId: null, view: 'journal' })
  })
  test('group views', () => {
    expect(spaceFromSegments(['g', 'g1'])).toEqual({ groupId: 'g1', view: 'journal' })
    expect(spaceFromSegments(['g', 'g1', 'activity'])).toEqual({ groupId: 'g1', view: 'activity' })
    expect(spaceFromSegments(['g', 'g1', 'places', 'p9'])).toEqual({ groupId: 'g1', view: 'journal' })
    expect(spaceFromSegments(['g', 'a%20b', 'near'])).toEqual({ groupId: 'a b', view: 'near' })
  })
  test('anything else is Personal journal', () => {
    expect(spaceFromSegments(null)).toEqual({ groupId: null, view: 'journal' })
    expect(spaceFromSegments(['__DEFAULT__'])).toEqual({ groupId: null, view: 'journal' })
  })
})

describe('groupsChangeTarget: where to go after create / join / leave / delete', () => {
  const list = [{ id: 'a' }, { id: 'b' }]
  test('a new group opens at once', () => {
    expect(groupsChangeTarget({ newId: 'b', open: null, list, sheetOpen: false })).toEqual({ go: 'b', pending: null })
  })
  test('from the Groups sheet it waits until the sheet closes (the sheet keeps its "invite code" hint)', () => {
    expect(groupsChangeTarget({ newId: 'b', open: 'a', list, sheetOpen: true })).toEqual({ go: null, pending: 'b' })
  })
  test('leaving the open group goes to Personal, but not under the open sheet (the group space does it after)', () => {
    expect(groupsChangeTarget({ newId: null, open: 'gone', list, sheetOpen: false })).toEqual({ go: 'personal', pending: null })
    expect(groupsChangeTarget({ newId: null, open: 'gone', list, sheetOpen: true })).toEqual({ go: null, pending: null })
  })
  test('nothing to do otherwise', () => {
    expect(groupsChangeTarget({ newId: null, open: 'a', list, sheetOpen: false })).toEqual({ go: null, pending: null })
    expect(groupsChangeTarget({ newId: 'zz', open: null, list, sheetOpen: false })).toEqual({ go: null, pending: null })
  })
})

describe('currentGroup: the open space from the address (group pages are one shared page, see next.config.mjs)', () => {
  test('a group address names its group', () => {
    expect(currentGroup('/g/g1', null)).toBe('g1')
    expect(currentGroup('/g/g1/near', 'g9')).toBe('g1')
    expect(currentGroup('/g/a%20b/places/p1', null)).toBe('a b')
  })
  test('Personal addresses are Personal', () => {
    for (const p of ['/', '/near', '/want-to-try', '/places/p1']) expect(currentGroup(p, 'g1')).toBe(null)
  })
  test('the Groups and You sheets keep the space underneath', () => {
    expect(currentGroup('/groups', 'g1')).toBe('g1')
    expect(currentGroup('/you', 'g1')).toBe('g1')
    expect(currentGroup('/groups', null)).toBe(null)
  })
})
