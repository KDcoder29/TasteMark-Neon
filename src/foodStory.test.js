import { describe, expect, test } from 'vitest'
import { foodStory } from './foodStory'

const places = [
  { name: 'Sankalp', city: 'Vadodara', dishes: [
    { name: 'Masala dosa', rating: 5, order_again: 'yes', created_at: '2026-01-02' },
    { name: 'Idli sambar', rating: 4, order_again: 'yes', created_at: '2026-01-03' },
  ] },
  { name: 'Coffea', city: 'vadodara ', dishes: [
    { name: 'Hazelnut cold coffee', rating: 5, order_again: 'maybe', created_at: '2026-02-01' },
  ] },
  { name: 'BiteX', city: 'Ahmedabad', dishes: [
    { name: 'Rava dosa', rating: 2, order_again: 'no', created_at: '2026-03-01' },
  ] },
]

describe('foodStory (the numbers in the You sheet)', () => {
  test('counts places, dishes and distinct cities (case and spaces ignored)', () => {
    const s = foodStory(places)
    expect(s.places).toBe(3)
    expect(s.dishes).toBe(4)
    expect(s.cities).toBe(2)
  })

  test('the favourite dish is the best rated; order-again wins a tie', () => {
    expect(foodStory(places).topDish).toEqual({ name: 'Masala dosa', place: 'Sankalp', rating: 5 })
  })

  test('no favourite dish when nothing is rated 4 or more', () => {
    expect(foodStory([{ name: 'X', dishes: [{ name: 'Tea', rating: 3 }] }]).topDish).toBe(null)
  })

  test('the food you eat most comes from the food dictionary, not from labels', () => {
    expect(foodStory(places).favourite).toBe('South Indian')
  })

  test('broad moods (drinks, something cold, snacks…) never count as your kind of food', () => {
    const cola = { name: 'Q', dishes: ['Soda', 'Lemon soda', 'Masala soda', 'Pizza', 'Margherita pizza'].map(name => ({ name, rating: 4 })) }
    expect(foodStory([cola]).favourite).toBe('Italian')
  })

  test('a single dish is not enough to call it a favourite kind of food', () => {
    expect(foodStory([{ name: 'X', dishes: [{ name: 'Pizza', rating: 5 }] }]).favourite).toBe(null)
  })

  test('order-again share is a whole percent of rated dishes', () => {
    expect(foodStory(places).againPct).toBe(50)
  })

  test('the most visited city keeps its written form', () => {
    expect(foodStory(places).topCity).toBe('Vadodara')
  })

  test('an empty journal gives zeros and nulls, not errors', () => {
    expect(foodStory([])).toEqual({ places: 0, dishes: 0, cities: 0, topDish: null, favourite: null, againPct: null, topCity: null })
  })
})
