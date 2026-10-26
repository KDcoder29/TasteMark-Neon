import { describe, expect, test } from 'vitest'
import { shouldDismiss, pullDistance, PULL_READY } from './gestures'

describe('shouldDismiss (swipe a bottom sheet down)', () => {
  test('a long slow drag closes it', () => {
    expect(shouldDismiss({ dy: 200, ms: 900, height: 600 })).toBe(true)
  })

  test('a short slow drag springs back', () => {
    expect(shouldDismiss({ dy: 60, ms: 700, height: 600 })).toBe(false)
  })

  test('a quick flick closes it even when short', () => {
    expect(shouldDismiss({ dy: 50, ms: 70, height: 600 })).toBe(true)
  })

  test('a tiny twitch never closes it, however fast', () => {
    expect(shouldDismiss({ dy: 12, ms: 5, height: 600 })).toBe(false)
  })

  test('dragging up never closes it', () => {
    expect(shouldDismiss({ dy: -300, ms: 100, height: 600 })).toBe(false)
  })

  test('on a short sheet a third of its height is enough', () => {
    expect(shouldDismiss({ dy: 90, ms: 800, height: 240 })).toBe(true)
  })
})

describe('pullDistance (pull to refresh)', () => {
  test('nothing when pulling up or not moving', () => {
    expect(pullDistance(-40)).toBe(0)
    expect(pullDistance(0)).toBe(0)
  })

  test('follows the finger with resistance', () => {
    expect(pullDistance(40)).toBeGreaterThan(20)
    expect(pullDistance(40)).toBeLessThan(40)
  })

  test('grows with the pull but never past a ceiling', () => {
    expect(pullDistance(200)).toBeGreaterThan(pullDistance(100))
    expect(pullDistance(5000)).toBeLessThanOrEqual(110)
  })

  test('a deliberate pull reaches the refresh point, a nudge does not', () => {
    expect(pullDistance(160)).toBeGreaterThanOrEqual(PULL_READY)
    expect(pullDistance(50)).toBeLessThan(PULL_READY)
  })
})
