import { describe, expect, test } from 'vitest'
import { placeSummary, placeWhere } from './placeView'

const p = dishes => ({ name: 'Raja Omlet', dishes })

describe('placeSummary', () => {
  test('averages the rated dishes to one decimal', () => {
    expect(placeSummary(p([{ rating: 5 }, { rating: 4 }, { rating: 4 }])).avg).toBe('4.3')
  })

  test('ignores unrated dishes and says null when nothing is rated', () => {
    expect(placeSummary(p([{ rating: 4 }, { rating: 0 }, { rating: null }])).avg).toBe('4.0')
    expect(placeSummary(p([{ rating: 0 }])).avg).toBe(null)
  })

  test('shows the price as a range, or one price when they are all the same', () => {
    expect(placeSummary(p([{ price: 180 }, { price: 40 }, { price: null }])).price).toBe('₹40–180')
    expect(placeSummary(p([{ price: 200 }, { price: 200 }])).price).toBe('₹200')
    expect(placeSummary(p([{ price: null }])).price).toBe('')
  })

  test('counts the loved dishes: rated 4★+ or marked order again', () => {
    const s = placeSummary(p([{ rating: 5 }, { rating: 2, order_again: 'yes' }, { rating: 3 }, { rating: 1 }, { rating: 4 }]))
    expect(s.loved).toBe(3)
    expect(placeSummary(p([{ rating: 2 }, { rating: 3 }])).loved).toBe(0)
  })

  test('counts dishes and the ones marked order again', () => {
    const s = placeSummary(p([{ order_again: 'yes' }, { order_again: 'no' }, { order_again: 'yes' }]))
    expect(s.dishCount).toBe(3)
    expect(s.againCount).toBe(2)
  })

  test('picks the must-try dish: order-again first, then the highest rating', () => {
    expect(placeSummary(p([{ name: 'A', rating: 5 }, { name: 'B', rating: 4, order_again: 'yes' }])).mustTry).toBe('B')
    expect(placeSummary(p([{ name: 'A', rating: 3 }, { name: 'B', rating: 5 }])).mustTry).toBe('B')
  })

  test('only calls a dish must-try if it is rated 4★+ or marked order again', () => {
    expect(placeSummary(p([{ name: 'Diet Coke', rating: 2 }])).mustTry).toBe(null)
    expect(placeSummary(p([{ name: 'A', rating: 3.9 }])).mustTry).toBe(null)
    expect(placeSummary(p([{ name: 'A', rating: 4 }])).mustTry).toBe('A')
  })

  test('has no must-try when nothing is rated or marked', () => {
    expect(placeSummary(p([{ name: 'A' }])).mustTry).toBe(null)
    expect(placeSummary(p([])).mustTry).toBe(null)
  })
})

describe('placeWhere', () => {
  test('joins area and city', () => {
    expect(placeWhere({ area: 'Mujmahuda', city: 'Vadodara' })).toBe('Mujmahuda, Vadodara')
  })

  test('drops placeholder values like "-" or "."', () => {
    expect(placeWhere({ area: '-', city: 'Vadodara' })).toBe('Vadodara')
    expect(placeWhere({ area: ' . ', city: '' })).toBe('')
  })
})
