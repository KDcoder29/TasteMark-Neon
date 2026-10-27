import { describe, expect, test } from 'vitest'
import { pickShareDishes, shareCaption, wrapLines, shareFileName } from './shareCard'

const place = {
  name: 'Sankalp', area: 'Alkapuri', city: 'Vadodara',
  dishes: [
    { name: 'Rava dosa', rating: 2, price: 160, note: 'Soggy' },
    { name: 'Masala dosa', rating: 5, price: 180, order_again: 'yes', note: 'Crispy' },
    { name: 'Filter coffee', rating: 4, price: 60, note: '' },
    { name: 'Idli', rating: 5, price: 80, order_again: 'maybe', note: 'Soft' },
    { name: 'Upma', rating: 4, price: 90, note: 'Ok' },
    { name: 'Vada', rating: 4, price: 70, note: 'Fine' },
  ],
}

describe('pickShareDishes (what goes on the picture)', () => {
  test('only recommendations (4★ and up), best first, order-again wins a tie, at most 4', () => {
    expect(pickShareDishes(place).shown.map(d => d.name)).toEqual(['Masala dosa', 'Idli', 'Filter coffee', 'Upma'])
  })

  test('says how many more are in the journal', () => {
    expect(pickShareDishes(place).more).toBe(2)
  })

  test('when nothing is 4★, the best three are shown instead of an empty card', () => {
    const p = { dishes: [{ name: 'A', rating: 3 }, { name: 'B', rating: 1 }, { name: 'C', rating: 2 }, { name: 'D', rating: 3 }] }
    expect(pickShareDishes(p).shown.map(d => d.name)).toEqual(['A', 'D', 'C'])
  })

  test('group places share the average rating', () => {
    const p = { dishes: [{ name: 'A', avg: 4.5, nRatings: 2 }, { name: 'B', avg: 3.2, nRatings: 3 }] }
    expect(pickShareDishes(p).shown.map(d => [d.name, d.stars])).toEqual([['A', 4.5]])
  })

  test('no dishes at all', () => {
    expect(pickShareDishes({ dishes: [] })).toEqual({ shown: [], more: 0 })
  })
})

describe('shareCaption (the WhatsApp text)', () => {
  test('place, where, the dishes with stars and price, and where it came from', () => {
    const { shown } = pickShareDishes(place)
    expect(shareCaption(place, shown.slice(0, 2), { prices: true, notes: true })).toBe(
      '*Sankalp* · Alkapuri, Vadodara\n' +
      '• Masala dosa · 5★ · ₹180 · Crispy\n' +
      '• Idli · 5★ · ₹80 · Soft\n' +
      '\nFrom my BiteMark food journal')
  })

  test('prices and notes can be left out', () => {
    const { shown } = pickShareDishes(place)
    expect(shareCaption(place, shown.slice(0, 1), { prices: false, notes: false })).toBe(
      '*Sankalp* · Alkapuri, Vadodara\n• Masala dosa · 5★\n\nFrom my BiteMark food journal')
  })

  test('a map line when asked: the exact saved link, or a Maps search', () => {
    const { shown } = pickShareDishes(place)
    expect(shareCaption({ ...place, maps_url: 'https://maps.app.goo.gl/AbC' }, shown.slice(0, 1), { prices: false, notes: false, map: true })).toBe(
      '*Sankalp* · Alkapuri, Vadodara\n• Masala dosa · 5★\nMap: https://maps.app.goo.gl/AbC\n\nFrom my BiteMark food journal')
    expect(shareCaption(place, [], { map: true })).toContain('Map: https://www.google.com/maps/search/?api=1&query=Sankalp%2C%20Alkapuri%2C%20Vadodara')
  })

  test('an average shows one decimal', () => {
    const p = { name: 'X', dishes: [] }
    expect(shareCaption(p, [{ name: 'A', stars: 4.5 }], { prices: true, notes: true })).toBe('*X*\n• A · 4.5★\n\nFrom my BiteMark food journal')
  })
})

describe('wrapLines (text that fits the picture)', () => {
  const measure = s => s.length * 10              // every letter 10px wide

  test('keeps short text on one line', () => {
    expect(wrapLines(measure, 'Masala dosa', 200, 2)).toEqual(['Masala dosa'])
  })

  test('breaks between words', () => {
    expect(wrapLines(measure, 'Nutri Choice Oats n Millets', 130, 3)).toEqual(['Nutri Choice', 'Oats n', 'Millets'])
  })

  test('cuts with an ellipsis after the last allowed line', () => {
    expect(wrapLines(measure, 'one two three four five six', 100, 2)).toEqual(['one two', 'three fou…'])
  })

  test('a single very long word is cut too', () => {
    expect(wrapLines(measure, 'Supercalifragilistic', 100, 1)).toEqual(['Supercali…'])
  })
})

test('shareFileName is a safe, readable file name', () => {
  expect(shareFileName('Coffea: Brew on the Rocks!')).toBe('coffea-brew-on-the-rocks-bitemark.png')
  expect(shareFileName('😋')).toBe('place-bitemark.png')
})
