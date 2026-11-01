import { describe, it, expect } from 'vitest'
import { isChanged, savePrompt, createUnsaved } from '@/lib/unsaved'

describe('isChanged: did the person really change something?', () => {
  it('the same values are no change, even with blanks written differently', () => {
    expect(isChanged({ name: 'Sankalp', price: 120, note: '' }, { name: 'Sankalp', price: '120', note: null })).toBe(false)
    expect(isChanged({ name: 'Sankalp ' }, { name: 'Sankalp' })).toBe(false)
    expect(isChanged([{ a: 1 }], [{ a: 1 }])).toBe(false)
    expect(isChanged({ cats: [] }, { cats: undefined })).toBe(false)
  })
  it('a typed letter, a new dish, a removed tag or a moved pin is a change', () => {
    expect(isChanged({ name: '' }, { name: 'S' })).toBe(true)
    expect(isChanged([{ name: '' }], [{ name: '' }, { name: '' }])).toBe(true)
    expect(isChanged({ cats: ['Cafe'] }, { cats: [] })).toBe(true)
    expect(isChanged({ loc: { lat: 1, lng: 2 } }, { loc: { lat: 1, lng: 3 } })).toBe(true)
    expect(isChanged({ loc: null }, { loc: { lat: 1, lng: 2 } })).toBe(true)
  })
})

describe('savePrompt', () => {
  it('asks in BiteMark words: Save / Continue without saving / Keep editing', () => {
    expect(savePrompt('this place')).toEqual({
      title: 'Save your changes?',
      message: 'You’ve changed this place and haven’t saved it.',
      choices: [
        { value: 'save', label: 'Save', tone: 'pri' },
        { value: 'discard', label: 'Continue without saving', tone: 'danger' },
        { value: 'keep', label: 'Keep editing', tone: 'plain' },
      ],
      dismiss: 'keep',
    })
  })
  it('without a way to save, there is no Save button', () => {
    expect(savePrompt('x', false).choices.map(c => c.value)).toEqual(['discard', 'keep'])
  })
})

// a browser stand-in: history with real back/forward and popstate
function fakeWindow() {
  const entries = [{ state: { page: 1 }, url: '/' }]
  let at = 0
  const pops = new Set(), unloads = new Set()
  const win = {
    location: { get href() { return entries[at].url } },
    history: {
      get state() { return entries[at].state },
      get length() { return entries.length },
      pushState(state, _t, url) { entries.splice(at + 1); entries.push({ state, url: url ?? entries[at].url }); at++ },
      back() { if (at > 0) { at--; queueMicrotask(() => pops.forEach(f => f({ state: entries[at].state }))) } },
    },
    addEventListener(t, f) { (t === 'popstate' ? pops : unloads).add(f) },
    removeEventListener(t, f) { (t === 'popstate' ? pops : unloads).delete(f) },
    // the person presses the phone's Back button
    pressBack() { win.history.back() },
    beforeUnload() { const e = { preventDefault() { e.prevented = true }, returnValue: undefined }; unloads.forEach(f => f(e)); return e },
    entries, get at() { return at },
  }
  return win
}
const tick = () => new Promise(r => setTimeout(r, 0))

describe('createUnsaved: the app-wide unsaved-changes guard', () => {
  const setup = (answer = 'keep') => {
    const win = fakeWindow(), asked = []
    const u = createUnsaved({ win, ask: async o => { asked.push(o); return answer } })
    return { win, asked, u }
  }

  it('closing with nothing changed closes at once, without asking', async () => {
    const { u, asked } = setup()
    expect(await u.leave('form')).toBe(true)
    expect(asked).toEqual([])
  })

  it('closing with changes asks; Keep editing keeps it open', async () => {
    const { u, asked } = setup('keep')
    u.set('a', { scope: 'form', what: 'this place' })
    expect(await u.leave('form')).toBe(false)
    expect(asked[0].title).toBe('Save your changes?')
    expect(asked[0].message).toContain('this place')
  })

  it('Discard lets it close and takes the Back-guard step away again', async () => {
    const { u, win } = setup('discard')
    u.set('a', { scope: 'form', what: 'this place' })
    expect(win.at).toBe(1)                       // one extra history step while unsaved
    expect(await u.leave('form')).toBe(true)
    expect(win.at).toBe(0)
  })

  it('only asks about changes inside what is being closed', async () => {
    const { u, asked } = setup('keep')
    u.set('w', { scope: 'wishlist', what: 'this place to try' })
    expect(await u.leave('place')).toBe(true)
    expect(asked).toEqual([])
  })

  it('the phone Back button asks; Keep editing stays (the guard step comes back)', async () => {
    const { u, win, asked } = setup('keep')
    let closed = 0
    u.set('a', { scope: 'form', what: 'this dish', close: () => closed++ })
    win.pressBack(); await tick(); await tick()
    expect(asked.length).toBe(1)
    expect(closed).toBe(0)
    expect(win.at).toBe(1)
  })

  it('Back then Discard closes the form', async () => {
    const { u, win } = setup('discard')
    let closed = 0
    u.set('a', { scope: 'form', what: 'this dish', close: () => closed++ })
    win.pressBack(); await tick(); await tick()
    expect(closed).toBe(1)
    expect(win.at).toBe(0)
  })

  it('Back then Discard with no close of its own carries on Back (e.g. a comment in the place sheet)', async () => {
    const { u, win } = setup('discard')
    win.history.pushState({ page: 2 }, '', '/places/p1')       // the place sheet's own step
    u.set('c', { scope: 'place', what: 'your comment' })
    expect(win.at).toBe(2)
    win.pressBack(); await tick(); await tick(); await tick()
    expect(win.at).toBe(0)
  })

  it('saving (the form goes away clean) removes the guard step', async () => {
    const { u, win } = setup()
    u.set('a', { scope: 'form', what: 'x' })
    u.set('a', null)
    await tick()
    expect(win.at).toBe(0)
  })

  it('does not step back when the app already moved on (a link was opened meanwhile)', async () => {
    const { u, win } = setup()
    u.set('a', { scope: 'form', what: 'x' })
    win.history.pushState({ page: 3 }, '', '/near')
    u.set('a', null)
    await tick()
    expect(win.at).toBe(2)
  })

  it('refresh or closing the tab gets the browser warning only while something is unsaved', () => {
    const { u, win } = setup()
    expect(win.beforeUnload().prevented).toBeUndefined()
    u.set('a', { scope: 'form', what: 'x' })
    expect(win.beforeUnload().prevented).toBe(true)
    u.set('a', null)
    expect(win.beforeUnload().prevented).toBeUndefined()
  })

  it('Save saves, then lets it close', async () => {
    const { u, win } = setup('save')
    let saved = 0
    u.set('a', { scope: 'form', what: 'x', save: async () => { saved++; return true } })
    expect(await u.leave('form')).toBe(true)
    expect(saved).toBe(1)
    expect(win.at).toBe(0)
  })

  it('Save that fails (e.g. a missing name) keeps it open, still guarded', async () => {
    const { u, win } = setup('save')
    u.set('a', { scope: 'form', what: 'x', save: async () => false })
    expect(await u.leave('form')).toBe(false)
    expect(win.at).toBe(1)
    expect(u.dirty('form')).toBe(true)
  })

  it('Back then Save saves and closes', async () => {
    const { u, win } = setup('save')
    let saved = 0, closed = 0
    u.set('a', { scope: 'form', what: 'x', save: async () => { saved++; return true }, close: () => closed++ })
    win.pressBack(); await tick(); await tick(); await tick()
    expect([saved, closed, win.at]).toEqual([1, 1, 0])
  })

  it('Back then a failed Save stays, and the guard step comes back', async () => {
    const { u, win } = setup('save')
    let closed = 0
    u.set('a', { scope: 'form', what: 'x', save: async () => false, close: () => closed++ })
    win.pressBack(); await tick(); await tick(); await tick()
    expect([closed, win.at]).toEqual([0, 1])
  })
})
