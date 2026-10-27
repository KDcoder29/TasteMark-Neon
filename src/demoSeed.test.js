import { describe, expect, test } from 'vitest'
import { SEED } from '../db/demo/demo-seed.mjs'
import { CATEGORIES } from './shared'

const places = SEED.places
const dishes = places.flatMap(p => p.dishes)

describe('the public demo journal (sample data)', () => {
  test('more than 70 places, each with more than 2 dishes', () => {
    expect(places.length).toBeGreaterThan(70)
    for (const p of places) expect(p.dishes.length, p.name).toBeGreaterThanOrEqual(3)
  })

  test('half in Vadodara, half in Ahmedabad, nowhere else', () => {
    const v = places.filter(p => p.city === 'Vadodara').length
    const a = places.filter(p => p.city === 'Ahmedabad').length
    expect(v + a).toBe(places.length)
    expect(v).toBe(a)
  })

  test('every category, star rating and order-again answer appears many times', () => {
    for (const c of CATEGORIES) expect(places.filter(p => p.categories.includes(c)).length, c).toBeGreaterThanOrEqual(5)
    for (const r of [1, 2, 3, 4, 5]) expect(dishes.filter(d => d.rating === r).length, `${r}★`).toBeGreaterThanOrEqual(8)
    for (const a of ['yes', 'maybe', 'no']) expect(dishes.filter(d => d.again === a).length, a).toBeGreaterThanOrEqual(10)
  })

  test('each place has an area and only known categories; every dish has a price and a comment', () => {
    for (const p of places) {
      expect(p.area, p.name).toBeTruthy()
      for (const c of p.categories) expect(CATEGORIES).toContain(c)
      for (const d of p.dishes) {
        expect(d.price, d.name).toBeGreaterThan(0)
        expect(d.note?.trim(), d.name).toBeTruthy()
        expect([1, 2, 3, 4, 5]).toContain(d.rating)
      }
    }
  })

  test('prices from street food to fine dining (so the price filter has a range)', () => {
    const prices = dishes.map(d => d.price)
    expect(Math.min(...prices)).toBeLessThanOrEqual(40)
    expect(Math.max(...prices)).toBeGreaterThanOrEqual(900)
  })

  test('food families the Craving chat knows are all there', () => {
    const names = dishes.map(d => d.name.toLowerCase()).join(' | ')
    for (const w of ['dosa', 'idli', 'khaman', 'dabeli', 'pav bhaji', 'pizza', 'momos', 'cold coffee', 'kulfi', 'salad', 'thali', 'paneer'])
      expect(names, w).toContain(w)
  })

  test('place names are unique within a city', () => {
    const keys = places.map(p => p.city + '|' + p.name.toLowerCase())
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('a Want to try list and a group with places, ratings, reactions and comments', () => {
    expect(SEED.wishlist.length).toBeGreaterThanOrEqual(5)
    expect(SEED.group.places.length).toBeGreaterThanOrEqual(5)
    const gd = SEED.group.places.flatMap(p => p.dishes)
    expect(gd.some(d => d.reactions?.length)).toBe(true)
    expect(gd.some(d => d.comments?.length)).toBe(true)
    expect(SEED.group.wishlist.length).toBeGreaterThanOrEqual(1)
  })
})
