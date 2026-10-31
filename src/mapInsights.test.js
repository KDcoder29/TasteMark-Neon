import { describe, it, expect } from 'vitest'
import { areaKey, areaSummary, heatPoints, foodHome, addedByOptions, adderInitial } from './mapInsights'

const place = (name, area, ratings, extra = {}) => ({
  name, area, dishes: ratings.map((r, i) => ({ name: `${name} dish ${i}`, rating: r, created_at: `2026-01-0${i + 1}` })), ...extra,
})

describe('areaKey', () => {
  it('takes the last comma part, folded', () => {
    expect(areaKey({ area: 'Express Hotel, Alkapuri' })).toBe('alkapuri')
    expect(areaKey({ area: 'Near Fatehgunj / Sayajigunj' })).toBe('sayajigunj')
  })
  it('is empty without an area', () => {
    expect(areaKey({})).toBe('')
    expect(areaKey({ area: '  ' })).toBe('')
  })
})

describe('areaSummary', () => {
  const items = [
    place('Sankalp', 'Alkapuri', [5]), place('B', 'Hotel, Alkapuri', [4]), place('C', 'Alkapuri', [3]),
    place('D', 'Sayajigunj', [2]),
  ]
  it('summarises an area', () => {
    const s = areaSummary(items)
    expect(s.name).toBe('Alkapuri')
    expect(s.count).toBe(4)
    expect(s.avg).toBe(3.5)
    expect(s.best).toEqual({ dish: 'Sankalp dish 0', place: 'Sankalp' })
  })
  it('counts wishes but ignores them for the average', () => {
    const s = areaSummary([place('A', 'Alkapuri', [4]), { name: 'W', area: 'Alkapuri' }])
    expect(s.count).toBe(2)
    expect(s.avg).toBe(4)
  })
  it('uses each place\'s best dish for the average', () => {
    expect(areaSummary([place('A', 'X', [5, 1]), place('B', 'X', [3])]).avg).toBe(4)
  })
  it('breaks best-dish ties by most recent', () => {
    const s = areaSummary([{ name: 'A', area: 'X', dishes: [{ name: 'old', rating: 5, created_at: '2026-01-01' }, { name: 'new', rating: 5, created_at: '2026-02-01' }] }])
    expect(s.best.dish).toBe('new')
  })
  it('handles an empty list', () => {
    expect(areaSummary([])).toMatchObject({ count: 0, avg: null, best: null })
  })
})

describe('heatPoints', () => {
  it('weights by dishes: min 0.2, 3 -> 0.5, 9 -> 1', () => {
    const d = n => Array.from({ length: n }, () => ({}))
    const pts = heatPoints([{ lat: 1, lng: 2, dishes: d(0) }, { lat: 3, lng: 4, dishes: d(3) }, { lat: 5, lng: 6, dishes: d(9) }])
    expect(pts).toEqual([[1, 2, 0.2], [3, 4, 0.5], [5, 6, 1]])
  })
  it('skips unlocated places', () => {
    expect(heatPoints([{ lat: null, lng: null, dishes: [{}] }, { dishes: [{}] }])).toEqual([])
  })
})

describe('foodHome', () => {
  const p = area => ({ area, dishes: [] })
  it('is the commonest area, in its first spelling', () => {
    expect(foodHome([p('X, Alkapuri'), p('Manjalpur'), p('Y, alkapuri'), p('Z, ALKAPURI')])).toEqual({ name: 'Alkapuri', count: 3 })
  })
  it('a tie goes to the first', () => {
    expect(foodHome([p('Manjalpur'), p('Alkapuri'), p('Manjalpur'), p('Alkapuri')])).toEqual({ name: 'Manjalpur', count: 2 })
  })
  it('is null under 2 places', () => {
    expect(foodHome([p('Alkapuri'), p('Manjalpur')])).toBeNull()
    expect(foodHome([])).toBeNull()
  })
})

describe('addedByOptions', () => {
  const names = { a: 'Asha', b: 'Bhavin' }
  it('starts with Everyone, then you as "You", then the others', () => {
    const items = [{ user_id: 'b' }, { user_id: 'a' }, { user_id: 'me1' }]
    expect(addedByOptions(items, { ...names, me1: 'Kandarp' }, 'me1')).toEqual([['', 'Everyone'], ['me1', 'You'], ['a', 'Asha'], ['b', 'Bhavin']])
  })
  it('collapses duplicates and lists only people who added something', () => {
    const items = [{ user_id: 'a' }, { user_id: 'a' }, {}]
    expect(addedByOptions(items, names, 'x')).toEqual([['', 'Everyone'], ['a', 'Asha']])
  })
  it('calls an unknown id "Someone" and keeps the ids distinct', () => {
    const o = addedByOptions([{ user_id: 'u1' }, { user_id: 'u2' }], {}, 'x')
    expect(o).toEqual([['', 'Everyone'], ['u1', 'Someone'], ['u2', 'Someone']])
  })
})

describe('adderInitial', () => {
  it('is the uppercase first letter of the name, "?" when unknown', () => {
    expect(adderInitial('a', { a: 'asha' }, 'x')).toBe('A')
    expect(adderInitial('zz', {}, 'x')).toBe('?')
    expect(adderInitial(undefined, {}, 'x')).toBe('?')
  })
  it('is your own first letter, or Y without a name', () => {
    expect(adderInitial('me1', { me1: 'Kandarp' }, 'me1')).toBe('K')
    expect(adderInitial('me1', {}, 'me1')).toBe('Y')
  })
})
