import { describe, expect, test, vi } from 'vitest'
import { createDialogs } from '@/lib/dialogs'

describe('createDialogs (the app’s own “Are you sure?” and message boxes)', () => {
  test('confirm resolves true when you agree, false when you cancel', async () => {
    const d = createDialogs()
    const yes = d.confirm({ title: 'Delete?' })
    d.answer(true)
    expect(await yes).toBe(true)
    const no = d.confirm({ title: 'Delete?' })
    d.answer(false)
    expect(await no).toBe(false)
  })

  test('alert resolves once it is closed', async () => {
    const d = createDialogs()
    const done = d.alert({ title: 'Could not save', message: 'Network' })
    expect(d.current()).toMatchObject({ kind: 'alert', title: 'Could not save', message: 'Network' })
    d.answer()
    await expect(done).resolves.toBeUndefined()
    expect(d.current()).toBe(null)
  })

  test('a plain string becomes the message, with sensible button names', () => {
    const d = createDialogs()
    d.confirm('Leave the group?')
    expect(d.current()).toMatchObject({ message: 'Leave the group?', confirmLabel: 'OK', cancelLabel: 'Cancel', danger: false })
  })

  test('two at once are shown one after the other, in order', async () => {
    const d = createDialogs()
    const a = d.confirm({ title: 'A' }), b = d.alert({ title: 'B' })
    expect(d.current().title).toBe('A')
    d.answer(true)
    expect(d.current().title).toBe('B')
    d.answer()
    expect(await a).toBe(true)
    await expect(b).resolves.toBeUndefined()
  })

  test('the screen hears about every change', () => {
    const d = createDialogs()
    const seen = vi.fn()
    const stop = d.subscribe(seen)
    d.confirm({ title: 'A' })
    d.answer(false)
    stop()
    d.confirm({ title: 'B' })
    expect(seen.mock.calls.map(c => c[0]?.title ?? null)).toEqual(['A', null])
  })

  test('answering with nothing open is harmless', () => {
    expect(() => createDialogs().answer(true)).not.toThrow()
  })
})

describe('choose (three answers, e.g. Save / Continue without saving / Keep editing)', () => {
  test('resolves the value of the chosen button', async () => {
    const d = createDialogs()
    const pick = d.choose({ title: 'Save your changes?', choices: [{ value: 'save', label: 'Save' }, { value: 'keep', label: 'Keep editing' }], dismiss: 'keep' })
    expect(d.current()).toMatchObject({ kind: 'choice', title: 'Save your changes?' })
    d.answer('save')
    expect(await pick).toBe('save')
  })
  test('Escape or a tap outside gives the dismiss value', async () => {
    const d = createDialogs()
    const pick = d.choose({ choices: [{ value: 'save', label: 'Save' }], dismiss: 'keep' })
    d.dismiss()
    expect(await pick).toBe('keep')
  })
  test('dismiss on a confirm is a no, on an alert just closes', async () => {
    const d = createDialogs()
    const c = d.confirm({ title: 'Delete?' }); d.dismiss()
    expect(await c).toBe(false)
    const a = d.alert({ title: 'x' }); d.dismiss()
    await expect(a).resolves.toBeUndefined()
  })
})
