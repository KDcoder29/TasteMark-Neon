import { describe, expect, test, vi } from 'vitest'
import { createLayers, createScrollLock } from './layers'

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

describe('createScrollLock (the page behind a sheet or dialog stays put)', () => {
  test('locks while anything is open, nested layers included, then restores', () => {
    const style = { overflow: 'auto' }
    const lock = createScrollLock(style)
    const a = lock()
    expect(style.overflow).toBe('hidden')
    const b = lock()
    a()
    expect(style.overflow).toBe('hidden')        // the top layer is still open
    b()
    expect(style.overflow).toBe('auto')
  })

  test('unlocking twice is harmless', () => {
    const style = { overflow: '' }
    const lock = createScrollLock(style)
    const a = lock(); const b = lock()
    a(); a()
    expect(style.overflow).toBe('hidden')
    b()
    expect(style.overflow).toBe('')
  })
})
