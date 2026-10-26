import { describe, expect, test } from 'vitest'
import { filterPlaces, sortPlaces, activeFilterCount, NO_FILTERS } from './journalFilter'

const dish = (name, rating, price, order_again = null, note = '') => ({ name, rating, price, order_again, note })
const places = [
  { id: 'a', name: 'Raja Omlet', city: 'Vadodara', area: 'Mujmahuda', categories: ['Food'], created_at: '2026-01-03',
    dishes: [dish('Japanese Fry', 5, 180, 'yes', 'cheesy gravy'), dish('Plain Omelette', 2, 60)] },
  { id: 'b', name: 'JP Soda', city: 'Vadodara', area: 'TP 13', categories: ['Cafe'], created_at: '2026-01-02',
    dishes: [dish('Masala Soda', 4, 40), dish('Jeera Soda', 3, 40)] },
  { id: 'c', name: 'BiteX', city: 'Ahmedabad', area: 'Memnagar', categories: ['Cafe'], created_at: '2026-01-01',
    dishes: [dish('Hazelnut Cold Coffee', 3, 173)] },
  { id: 'd', name: 'Empty Cafe', city: 'Vadodara', area: '', categories: ['Cafe'], created_at: '2026-01-04', dishes: [] },
]
const f = over => ({ ...NO_FILTERS, ...over })
const ids = list => list.map(p => p.id)

describe('filterPlaces', () => {
  test('with no filters keeps every place and all its dishes', () => {
    const out = filterPlaces(places, NO_FILTERS)
    expect(ids(out)).toEqual(['a', 'b', 'c', 'd'])
    expect(out[0].dishes).toHaveLength(2)
    expect(out[0].allDishes).toHaveLength(2)
  })

  test('filters by city and by category', () => {
    expect(ids(filterPlaces(places, f({ city: 'Ahmedabad' })))).toEqual(['c'])
    expect(ids(filterPlaces(places, f({ cat: 'Cafe' })))).toEqual(['b', 'c', 'd'])
  })

  test('a dish filter keeps only matching dishes and drops places with none', () => {
    const out = filterPlaces(places, f({ minRate: 4 }))
    expect(ids(out)).toEqual(['a', 'b'])
    expect(out[0].dishes.map(d => d.name)).toEqual(['Japanese Fry'])
    expect(ids(filterPlaces(places, f({ again: true })))).toEqual(['a'])
    expect(ids(filterPlaces(places, f({ maxPrice: 50 })))).toEqual(['b'])
  })

  test('search keeps the matching dishes, smart-matched by name or note', () => {
    const out = filterPlaces(places, f({ q: 'soda' }))
    expect(ids(out)).toEqual(['b'])
    expect(ids(filterPlaces(places, f({ q: 'cheesy' })))).toEqual(['a'])
  })

  test('search finds a place with no dishes by its own name', () => {
    expect(ids(filterPlaces(places, f({ q: 'empty' })))).toEqual(['d'])
  })
})

describe('sortPlaces', () => {
  const all = filterPlaces(places, NO_FILTERS)
  test('newest first by default, oldest, and A to Z', () => {
    expect(ids(sortPlaces(all, 'recent', ''))).toEqual(['d', 'a', 'b', 'c'])
    expect(ids(sortPlaces(all, 'oldest', ''))).toEqual(['c', 'b', 'a', 'd'])
    expect(ids(sortPlaces(all, 'name', ''))).toEqual(['c', 'd', 'b', 'a'])
  })

  test('by price, places without prices last', () => {
    expect(ids(sortPlaces(all, 'cheap', ''))).toEqual(['b', 'a', 'c', 'd'])
  })

  test('while searching with the default sort, the best match comes first', () => {
    const out = sortPlaces(filterPlaces(places, f({ q: 'cold coffee' })), 'recent', 'cold coffee')
    expect(ids(out)[0]).toBe('c')
  })
})

describe('activeFilterCount', () => {
  test('counts the filters that narrow the list (not search, not sort)', () => {
    expect(activeFilterCount(NO_FILTERS, 2000)).toBe(0)
    expect(activeFilterCount(f({ city: 'Vadodara', cat: 'Cafe', again: true }), 2000)).toBe(3)
    expect(activeFilterCount(f({ minRate: 4, maxPrice: 300 }), 2000)).toBe(2)
  })

  test('a price at the top of the slider counts as no price filter', () => {
    expect(activeFilterCount(f({ maxPrice: 2000 }), 2000)).toBe(0)
  })
})
