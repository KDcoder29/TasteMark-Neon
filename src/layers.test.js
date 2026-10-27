import { describe, expect, test, vi } from 'vitest'
import { createLayers } from './layers'

describe('createLayers (Escape closes only the top sheet / dialog)', () => {
  test('Escape closes the most recently opened layer only', () => {
    const l = createLayers()
    const detail = vi.fn(), share = vi.fn()
    l.open(detail); l.open(share)
    expect(l.escape()).toBe(true)
    expect(share).toHaveBeenCalledTimes(1)
    expect(detail).not.toHaveBeenCalled()
  })

  test('after the top one closes, the next Escape reaches the one below', () => {
    const l = createLayers()
    const detail = vi.fn(), share = vi.fn()
    l.open(detail)
    const closeShare = l.open(share)
    closeShare()
    l.escape()
    expect(detail).toHaveBeenCalledTimes(1)
    expect(share).not.toHaveBeenCalled()
  })

  test('nothing open: Escape does nothing and says so', () => {
    expect(createLayers().escape()).toBe(false)
  })

  test('closing a layer twice is harmless', () => {
    const l = createLayers()
    const a = vi.fn()
    l.open(a)
    const close = l.open(vi.fn())
    close(); close()
    l.escape()
    expect(a).toHaveBeenCalledTimes(1)
  })
})
