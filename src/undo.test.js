import { describe, expect, test, vi } from 'vitest'
import { createUndo } from './undo'

const setup = () => {
  const commit = vi.fn()
  const changed = vi.fn()
  const u = createUndo({ commit, delay: 5000, onChange: changed })
  return { u, commit, changed }
}

describe('createUndo (remove now, really delete a few seconds later)', () => {
  test('a removed item is pending and only deleted after the delay', () => {
    vi.useFakeTimers()
    const { u, commit } = setup()
    u.remove({ id: 1 })
    expect(u.pending()).toEqual({ id: 1 })
    vi.advanceTimersByTime(4999)
    expect(commit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(commit).toHaveBeenCalledWith({ id: 1 })
    expect(u.pending()).toBe(null)
    vi.useRealTimers()
  })

  test('undo brings it back and nothing is deleted', () => {
    vi.useFakeTimers()
    const { u, commit } = setup()
    u.remove({ id: 1 })
    expect(u.undo()).toEqual({ id: 1 })
    vi.advanceTimersByTime(10000)
    expect(commit).not.toHaveBeenCalled()
    expect(u.pending()).toBe(null)
    vi.useRealTimers()
  })

  test('removing a second item deletes the first straight away', () => {
    vi.useFakeTimers()
    const { u, commit } = setup()
    u.remove({ id: 1 })
    u.remove({ id: 2 })
    expect(commit).toHaveBeenCalledTimes(1)
    expect(commit).toHaveBeenCalledWith({ id: 1 })
    expect(u.pending()).toEqual({ id: 2 })
    vi.useRealTimers()
  })

  test('flush (leaving the screen) deletes what is pending at once, only once', () => {
    vi.useFakeTimers()
    const { u, commit } = setup()
    u.remove({ id: 1 })
    u.flush()
    vi.advanceTimersByTime(10000)
    expect(commit).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  test('tells the screen whenever the pending item changes', () => {
    vi.useFakeTimers()
    const { u, changed } = setup()
    u.remove({ id: 1 })
    u.undo()
    expect(changed.mock.calls.map(c => c[0])).toEqual([{ id: 1 }, null])
    vi.useRealTimers()
  })
})
