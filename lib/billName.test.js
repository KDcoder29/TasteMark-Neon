import { describe, expect, test } from 'vitest'
import { findRestaurantName } from '@/lib/billName'

// a bill as the reader sees it: one row per printed line, top to bottom, on a page `width` wide.
// [text, height, { x0, x1, ink, gap }] -> { text, x0, y0, x1, y1, ink }
// ink = share of dark pixels in the line's box (bold strokes are thicker); gap = extra space above
function bill(rows, width = 1000) {
  let y = 20
  return rows.map(([text, h = 30, o = {}]) => {
    y += o.gap || 8
    const len = text.length * h * 0.55
    const x0 = o.x0 ?? Math.round((width - len) / 2), x1 = o.x1 ?? Math.round(x0 + len)
    const line = { text, x0, y0: y, x1, y1: y + h, ink: o.ink ?? 0.18 }
    y += h
    return line
  })
}
const find = (rows, width = 1000) => findRestaurantName(bill(rows, width), { width })

const BODY = [
  ['Alkapuri, R C Dutt Road, Vadodara 390007'],
  ['GSTIN: 24AABCU9603R1ZX'],
  ['Date: 12/10/2026  Time: 21:14'],
  ['Table 7   Cashier: Ravi'],
  ['Masala Dosa        2   120   240', 30, { x0: 40 }],
  ['Filter Coffee      1    60    60', 30, { x0: 40 }],
  ['Total                       300', 30, { x0: 40 }],
]

describe('findRestaurantName: the restaurant name on a bill', () => {
  test('a bigger line at the top is the name', () => {
    expect(find([['SANKALP', 56], ...BODY])).toBe('Sankalp')
  })

  test('a bold line (thicker ink) of normal size is the name', () => {
    expect(find([['Kaffa Coffee Roasters', 30, { ink: 0.34 }], ...BODY])).toBe('Kaffa Coffee Roasters')
  })

  test('written on its own at the top, centred, in capitals: the name, even at body size', () => {
    expect(find([['MANDAP', 30, { gap: 40 }], ...BODY])).toBe('Mandap')
  })

  test('the name in two big lines is joined', () => {
    expect(find([['THE GRAND', 52], ['BHAGWATI', 52], ...BODY])).toBe('The Grand Bhagwati')
  })

  test('…also with the wide gap big print really has (real reader boxes: 41 px lines, 35 px apart, 20 px body)', () => {
    const body = BODY.map(([t, , o]) => [t, 20, o])
    expect(find([['THE GRAND', 41], ['BHAGWATI', 41, { gap: 35 }], ...body])).toBe('The Grand Bhagwati')
  })

  test('a "TAX INVOICE" banner above it is not the name', () => {
    expect(find([['TAX INVOICE', 34], ['Swati Snacks', 50], ...BODY])).toBe('Swati Snacks')
  })

  test('the company line ("... Pvt Ltd") and the address under the name are skipped', () => {
    expect(find([['Agashiye', 54], ['House of MG Hospitality Pvt Ltd', 26], ...BODY])).toBe('Agashiye')
  })

  test('keeps mixed case as printed; tidies OCR specks and trademark signs', () => {
    expect(find([['| Café Mocha ®', 50], ...BODY])).toBe('Café Mocha')
    expect(find([["McDonald's", 50], ...BODY])).toBe("McDonald's")
  })

  test('nothing stands out: no name rather than a wrong one', () => {
    const flat = [['Masala Dosa        2   120   240', 30, { x0: 40 }], ['Filter Coffee      1    60    60', 30, { x0: 40 }], ['Total                       300', 30, { x0: 40 }]]
    expect(find(flat)).toBe(null)
    expect(find(BODY)).toBe(null)
  })

  test('a big dish line or the big TOTAL is never the name', () => {
    expect(find([['Paneer Tikka        280', 56, { x0: 40 }], ...BODY])).toBe(null)
    expect(find([...BODY, ['GRAND TOTAL  300', 60]])).toBe(null)
  })

  test('no lines, or text without positions, is handled', () => {
    expect(findRestaurantName([], { width: 1000 })).toBe(null)
    expect(findRestaurantName(null)).toBe(null)
    expect(findRestaurantName([{ text: 'SANKALP' }, { text: 'GSTIN 24AAB' }])).toBe('Sankalp')
  })
})
