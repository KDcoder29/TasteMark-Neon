import { describe, expect, test } from 'vitest'
import { parseBillText } from './billParse'

describe('parseBillText', () => {
  test('reads a simple "name ..... price" line', () => {
    expect(parseBillText('Hazelnut Cold Coffee      200.00')).toEqual([{ name: 'Hazelnut Cold Coffee', price: 200 }])
  })

  test('reads several dish lines from a typical restaurant bill', () => {
    const bill = `
      COFFEA: BREW ON THE ROCKS
      13 Canal Rd, Vadodara
      Ph: 9876543210
      GSTIN: 24ABCDE1234F1Z5
      Bill No: 1042        Date: 12/10/2026
      Table: 4
      Item                Qty   Rate   Amount
      Hazelnut Cold Coffee  1   200.00  200.00
      Irish Cold Coffee     1   200.00  200.00
      Paneer Tikka Sandwich 1   180.00  180.00
      Sub Total                         580.00
      CGST @2.5%                         14.50
      SGST @2.5%                         14.50
      Grand Total                       609.00
      Thank you! Visit again
    `
    expect(parseBillText(bill)).toEqual([
      { name: 'Hazelnut Cold Coffee', price: 200 },
      { name: 'Irish Cold Coffee', price: 200 },
      { name: 'Paneer Tikka Sandwich', price: 180 },
    ])
  })

  test('skips tax, charges, totals and discounts', () => {
    const bill = [
      'Masala Dosa 120',
      'Service Charge 10% 12',
      'GST 5% 6.00',
      'Discount -20',
      'Round Off 0.40',
      'Net Amount 118',
      'Total 118',
      'Amount Payable 118',
      'Packing Charges 10',
      'Delivery charge 30',
    ].join('\n')
    expect(parseBillText(bill)).toEqual([{ name: 'Masala Dosa', price: 120 }])
  })

  test('uses the per-item rate when quantity, rate and amount are all on the line', () => {
    expect(parseBillText('Cold Coffee   2   180.00   360.00')).toEqual([{ name: 'Cold Coffee', price: 180 }])
  })

  test('reads "qty amount" lines as a per-item price', () => {
    expect(parseBillText('Cold Coffee   2   360')).toEqual([{ name: 'Cold Coffee', price: 180 }])
  })

  test('reads "rate amount" lines as the rate', () => {
    expect(parseBillText('Cold Coffee   180.00   360.00')).toEqual([{ name: 'Cold Coffee', price: 180 }])
  })

  test('divides the amount by the quantity for "2 x Name amount" lines', () => {
    expect(parseBillText('2 x Vada Pav 60')).toEqual([{ name: 'Vada Pav', price: 30 }])
    expect(parseBillText('2 Vada Pav 60')).toEqual([{ name: 'Vada Pav', price: 30 }])
  })

  test('handles ₹ / Rs prefixes and thousands separators', () => {
    expect(parseBillText('Veg Thali ₹ 250')).toEqual([{ name: 'Veg Thali', price: 250 }])
    expect(parseBillText('Butter Naan Rs. 45.00')).toEqual([{ name: 'Butter Naan', price: 45 }])
    expect(parseBillText('Family Feast Platter 1,250.00')).toEqual([{ name: 'Family Feast Platter', price: 1250 }])
  })

  test('rounds paise to the nearest rupee', () => {
    expect(parseBillText('Lemon Soda 49.50')).toEqual([{ name: 'Lemon Soda', price: 50 }])
  })

  test('ignores lines that are only numbers, dates, times or phone numbers', () => {
    const bill = ['12/10/2026 08:45 PM', '9876543210', '200.00', 'Mob: 98765 43210', 'Token 23'].join('\n')
    expect(parseBillText(bill)).toEqual([])
  })

  test('tidies OCR noise around the dish name', () => {
    expect(parseBillText('| Hazelnut  Cold Coffee .......... 200.00')).toEqual([{ name: 'Hazelnut Cold Coffee', price: 200 }])
    expect(parseBillText('1. Chocolate Shake : 150')).toEqual([{ name: 'Chocolate Shake', price: 150 }])
  })

  test('turns ALL-CAPS names into normal casing', () => {
    expect(parseBillText('PANEER BUTTER MASALA 280')).toEqual([{ name: 'Paneer Butter Masala', price: 280 }])
  })

  test('capitalises the first letter when OCR drops it', () => {
    expect(parseBillText('paneer Tikka Sandwich 1 180.00 180.00')).toEqual([{ name: 'Paneer Tikka Sandwich', price: 180 }])
  })

  test('returns an empty list for empty or unreadable text', () => {
    expect(parseBillText('')).toEqual([])
    expect(parseBillText(undefined)).toEqual([])
    expect(parseBillText('~~ ## ..')).toEqual([])
  })
})
