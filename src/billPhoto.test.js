import { describe, expect, test } from 'vitest'
import { billImageSize, canDeleteBill } from './billPhoto'

describe('billImageSize', () => {
  test('shrinks a phone photo so its long side is 1600 px, keeping the shape', () => {
    expect(billImageSize(3000, 4000)).toEqual({ width: 1200, height: 1600 })
    expect(billImageSize(4000, 3000)).toEqual({ width: 1600, height: 1200 })
  })

  test('never enlarges a small photo', () => {
    expect(billImageSize(600, 900)).toEqual({ width: 600, height: 900 })
  })

  test('rounds to whole pixels', () => {
    expect(billImageSize(3001, 4001)).toEqual({ width: 1200, height: 1600 })
  })
})

describe('canDeleteBill', () => {
  const bill = { user_id: 'me' }

  test('lets the person who added the bill delete it', () => {
    expect(canDeleteBill(bill, 'me', false)).toBe(true)
  })

  test('lets the group owner delete anyone\'s bill', () => {
    expect(canDeleteBill({ user_id: 'friend' }, 'me', true)).toBe(true)
  })

  test('does not let other members delete it', () => {
    expect(canDeleteBill({ user_id: 'friend' }, 'me', false)).toBe(false)
  })
})
