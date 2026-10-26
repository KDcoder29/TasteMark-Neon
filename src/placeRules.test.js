import { describe, expect, test } from 'vitest'
import { blankDish, mergeScannedDishes, newScannedDishes, placeFormError } from './placeRules'

const dish = over => ({ ...blankDish(), ...over })
const goodPlace = { f: { name: 'Coffea', city: 'Vadodara', area: 'Canal Rd' }, cats: ['Cafe'], editingGroup: false }
const rated = dish({ name: 'Cold Coffee', price: 200, rating: 4, note: 'Less sweet' })

describe('mergeScannedDishes', () => {
  test('replaces the single empty starter row with the scanned dishes', () => {
    const out = mergeScannedDishes([blankDish()], [{ name: 'Masala Dosa', price: 120 }, { name: 'Filter Coffee', price: 40 }])
    expect(out).toEqual([dish({ name: 'Masala Dosa', price: '120' }), dish({ name: 'Filter Coffee', price: '40' })])
  })

  test('keeps dishes you already typed and adds the scanned ones after them', () => {
    const typed = dish({ name: 'Vada Pav', price: '30', rating: 5 })
    const out = mergeScannedDishes([typed, blankDish()], [{ name: 'Masala Dosa', price: 120 }])
    expect(out).toEqual([typed, dish({ name: 'Masala Dosa', price: '120' })])
  })

  test('fills only name and price, leaving stars, order-again and comment blank', () => {
    const [d] = mergeScannedDishes([blankDish()], [{ name: 'Masala Dosa', price: 120 }])
    expect(d.rating).toBe(0)
    expect(d.order_again).toBe('')
    expect(d.note).toBe('')
  })

  test('leaves the rows untouched when nothing was scanned', () => {
    const rows = [blankDish()]
    expect(mergeScannedDishes(rows, [])).toBe(rows)
  })
})

describe('newScannedDishes', () => {
  test('drops scanned dishes whose name is already in the list, ignoring case and spaces', () => {
    const rows = [dish({ name: 'Masala Dosa', price: '120' })]
    const scanned = [{ name: 'masala  dosa ', price: 120 }, { name: 'Filter Coffee', price: 40 }]
    expect(newScannedDishes(rows, scanned)).toEqual([{ name: 'Filter Coffee', price: 40 }])
  })

  test('drops repeats within the same scan', () => {
    const scanned = [{ name: 'Vada Pav', price: 30 }, { name: 'VADA PAV', price: 30 }]
    expect(newScannedDishes([blankDish()], scanned)).toEqual([{ name: 'Vada Pav', price: 30 }])
  })

  test('keeps everything when nothing overlaps', () => {
    const scanned = [{ name: 'Vada Pav', price: 30 }]
    expect(newScannedDishes([blankDish()], scanned)).toEqual(scanned)
  })
})

describe('placeFormError', () => {
  test('accepts a place whose dishes all have name, price, stars and comment', () => {
    expect(placeFormError({ ...goodPlace, dishes: [rated] })).toBe('')
  })

  test('requires a star rating on every dish', () => {
    expect(placeFormError({ ...goodPlace, dishes: [{ ...rated, rating: 0 }] })).toBe('Please give every dish a star rating.')
  })

  test('requires a comment on every dish', () => {
    expect(placeFormError({ ...goodPlace, dishes: [{ ...rated, note: '' }] })).toBe('Please write a comment for every dish.')
  })

  test('treats a whitespace-only comment as missing', () => {
    expect(placeFormError({ ...goodPlace, dishes: [{ ...rated, note: '   ' }] })).toBe('Please write a comment for every dish.')
  })

  test('requires name and price on every dish', () => {
    expect(placeFormError({ ...goodPlace, dishes: [{ ...rated, price: '' }] })).toBe('Every dish needs a name and a price.')
    expect(placeFormError({ ...goodPlace, dishes: [{ ...rated, name: ' ' }] })).toBe('Every dish needs a name and a price.')
  })

  test('still checks the place fields first', () => {
    expect(placeFormError({ ...goodPlace, f: { ...goodPlace.f, area: '' }, dishes: [rated] })).toBe('Please fill in place name, city and area.')
    expect(placeFormError({ ...goodPlace, cats: [], dishes: [rated] })).toBe('Pick at least one category.')
  })

  test('skips dish checks when editing a group place (dishes are edited on the card)', () => {
    expect(placeFormError({ ...goodPlace, editingGroup: true, dishes: [blankDish()] })).toBe('')
  })
})
