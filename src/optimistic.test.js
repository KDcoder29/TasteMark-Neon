import { describe, expect, test, vi } from 'vitest'
import { optimistic } from './optimistic'

describe('optimistic (the screen changes at once; the server catches up)', () => {
  test('the change shows before the server answers, and stays when it succeeds', async () => {
    const order = []
    const ok = await optimistic({
      apply: () => order.push('apply'),
      run: async () => { order.push('run'); return { error: null } },
      undo: () => order.push('undo'),
      fail: () => order.push('fail'),
    })
    expect(ok).toBe(true)
    expect(order).toEqual(['apply', 'run'])
  })

  test('a server error (returned) puts it back and reports it', async () => {
    const undo = vi.fn(), fail = vi.fn()
    const ok = await optimistic({ apply() {}, run: async () => ({ error: { message: 'permission denied' } }), undo, fail })
    expect(ok).toBe(false)
    expect(undo).toHaveBeenCalledTimes(1)
    expect(fail).toHaveBeenCalledWith(expect.objectContaining({ message: 'permission denied' }))
  })

  test('a thrown error (no connection) also puts it back', async () => {
    const undo = vi.fn(), fail = vi.fn()
    expect(await optimistic({ apply() {}, run: async () => { throw new Error('Failed to fetch') }, undo, fail })).toBe(false)
    expect(undo).toHaveBeenCalled()
    expect(fail.mock.calls[0][0].message).toBe('Failed to fetch')
  })

  test('run may return nothing (e.g. a void delete helper)', async () => {
    expect(await optimistic({ apply() {}, run: async () => undefined, undo() {}, fail() {} })).toBe(true)
  })
})
