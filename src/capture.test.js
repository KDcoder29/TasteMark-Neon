import { describe, expect, test } from 'vitest'
import { canTakePhoto } from './capture'

const win = coarse => ({ matchMedia: q => ({ matches: q === '(pointer: coarse)' && coarse }) })

describe('canTakePhoto', () => {
  test('is true on phones and tablets (touch screen)', () => {
    expect(canTakePhoto(win(true))).toBe(true)
  })

  test('is false on laptops and desktops (mouse / trackpad)', () => {
    expect(canTakePhoto(win(false))).toBe(false)
  })

  test('is false when the browser cannot tell', () => {
    expect(canTakePhoto({})).toBe(false)
    expect(canTakePhoto(undefined)).toBe(false)
  })
})
