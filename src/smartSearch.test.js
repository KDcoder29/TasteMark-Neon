import { describe, expect, test } from 'vitest'
import { docsFromPlaces, parseCraving, cosine, rankDishes, relatedSearches } from './smartSearch'

const places = [
  { id: 'p1', name: 'Udupi Corner', area: 'Alkapuri', city: 'Vadodara', categories: ['Food'],
    dishes: [{ id: 'd1', name: 'Masala Dosa', price: 120, rating: 5, order_again: 'yes', note: 'crispy' },
             { id: 'd2', name: 'Idli Sambar', price: 80, rating: 3, note: '' }] },
  { id: 'p2', name: 'Coffea', area: 'Canal Rd', city: 'Vadodara', categories: ['Cafe'],
    dishes: [{ id: 'd3', name: 'Hazelnut Cold Coffee', price: 200, rating: 4, note: 'less sweet' }] },
  { id: 'p3', name: 'Burger Hub', area: '', city: 'Vadodara', categories: ['Food'],
    dishes: [{ id: 'd4', name: 'Aloo Tikki Burger', price: 90, rating: 4, note: '' }] },
]
const docs = docsFromPlaces(places)
const byName = (out, n) => out.find(r => r.doc.dish.name === n)

describe('docsFromPlaces', () => {
  test('makes one entry per dish, with place details folded into its text', () => {
    expect(docs).toHaveLength(4)
    expect(docs[0].text).toContain('Masala Dosa')
    expect(docs[0].text).toContain('crispy')
    expect(docs[0].text).toContain('Udupi Corner')
    expect(docs[0].place.id).toBe('p1')
  })

  test('adds the dish\'s food families to its text, so the AI model understands Indian dish names', () => {
    expect(docs[0].text).toContain('South Indian')
    expect(docs[2].text).toContain('Something cold')
  })

  test('gives each entry a key that changes only when its text changes', () => {
    expect(docsFromPlaces(places)[0].key).toBe(docs[0].key)
    const edited = docsFromPlaces([{ ...places[0], dishes: [{ ...places[0].dishes[0], note: 'soggy' }] }])
    expect(edited[0].key).not.toBe(docs[0].key)
  })
})

describe('parseCraving', () => {
  test('pulls a price limit out and keeps the food words', () => {
    expect(parseCraving('something cold under ₹150')).toEqual({ query: 'something cold', priceLimit: 150 })
    expect(parseCraving('south indian below 100 rs')).toEqual({ query: 'south indian', priceLimit: 100 })
    expect(parseCraving('dosa')).toEqual({ query: 'dosa', priceLimit: null })
  })
})

describe('cosine', () => {
  test('is 1 for the same direction and 0 for unrelated', () => {
    expect(cosine([1, 0], [2, 0])).toBeCloseTo(1)
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0)
  })
})

describe('rankDishes', () => {
  test('finds South Indian dishes you never labelled South Indian (dictionary)', () => {
    const out = rankDishes({ query: 'south indian', docs })
    expect(byName(out, 'Masala Dosa')).toBeTruthy()
    expect(byName(out, 'Idli Sambar')).toBeTruthy()
    expect(byName(out, 'Aloo Tikki Burger')).toBeFalsy()
  })

  test('matches dictionary words as whole words: "vada" is not "vadapav"', () => {
    const extra = docsFromPlaces([{ id: 'p9', name: 'Hariom', city: 'Ahmedabad', categories: ['Food'],
      dishes: [{ id: 'd9', name: 'Vadapav', price: 30, rating: 5 }, { id: 'd10', name: 'Medu Vada', price: 60, rating: 4 }] }])
    const out = rankDishes({ query: 'south indian', docs: [...docs, ...extra] })
    expect(byName(out, 'Vadapav')).toBeFalsy()
    expect(byName(out, 'Medu Vada')).toBeTruthy()
  })

  test('the dictionary still understands plurals ("dosas")', () => {
    const plural = docsFromPlaces([{ id: 'p8', name: 'X', dishes: [{ id: 'd8', name: 'Mini Dosas', rating: 4 }] }])
    expect(byName(rankDishes({ query: 'south indian', docs: plural }), 'Mini Dosas')).toBeTruthy()
  })

  test('finds dishes by meaning when the model is ready (vectors)', () => {
    const vecs = { [docs[2].key]: [1, 0], [docs[3].key]: [0, 1], [docs[0].key]: [0.1, 0.9], [docs[1].key]: [0, 1] }
    const out = rankDishes({ query: 'chilled caffeine', docs, qvec: [1, 0.05], vecs })
    expect(out[0].doc.dish.name).toBe('Hazelnut Cold Coffee')
    expect(out[0].why).toBe('meaning')
  })

  test('puts dishes you loved above ones you did not, when both match', () => {
    const out = rankDishes({ query: 'south indian', docs })
    expect(out[0].doc.dish.name).toBe('Masala Dosa')
  })

  test('respects a price limit', () => {
    const out = rankDishes({ query: 'south indian', docs, priceLimit: 100 })
    expect(out.map(r => r.doc.dish.name)).toEqual(['Idli Sambar'])
  })

  test('still matches plain words when the model is not ready', () => {
    expect(rankDishes({ query: 'burger', docs })[0].doc.dish.name).toBe('Aloo Tikki Burger')
  })
})

describe('relatedSearches', () => {
  test('suggests the found dishes and their other families, not what you asked', () => {
    const out = relatedSearches(rankDishes({ query: 'south indian', docs }), 'south indian')
    expect(out).toEqual(expect.arrayContaining(['Masala Dosa', 'Breakfast']))
    expect(out).not.toContain('South Indian')
    expect(out.length).toBeLessThanOrEqual(5)
  })
})
