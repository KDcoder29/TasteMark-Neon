import { describe, it, expect } from 'vitest'
import { earlyStart, EARLY_START_SCRIPT, likelyLoggedIn, markLoggedIn } from '@/lib/earlyStart'
import { loginHref } from '@/lib/nextPath'
import { rememberUser, clearFastStart } from '@/lib/fastStart'

// a tiny localStorage stand-in
function memStore(init = {}) {
  const m = new Map(Object.entries(init))
  return {
    getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k),
    key: i => [...m.keys()][i] ?? null, get length() { return m.size },
  }
}
const loggedIn = () => { const s = memStore(); rememberUser(s, { id: 'u1', email: 'a@b.c' }, 'Kandarp'); return s }

describe('earlyStart: the login hop before the app loads', () => {
  it('sends a visitor with nobody logged in on this device to /login, with next like the session gate', () => {
    for (const [path, search] of [['/', ''], ['/near', ''], ['/g/abc/activity', '?x=1'], ['/places/p1', '']])
      expect(earlyStart(path, search, () => memStore()).login).toBe(loginHref(path, search))
  })
  it('lets the app start when someone is logged in here', () => {
    expect(earlyStart('/near', '', loggedIn).login).toBe(null)
  })
  it('forgets the hint after Log out', () => {
    const s = loggedIn(); clearFastStart(s)
    expect(earlyStart('/', '', () => s).login).toBe('/login')
  })
  it('never redirects the logged-out pages, the share target or the API', () => {
    for (const p of ['/login', '/reset-password', '/share', '/api/maps-resolve'])
      expect(earlyStart(p, '', () => memStore()).login).toBe(null)
  })
  it('does nothing when storage is blocked (the session gate decides)', () => {
    const r = earlyStart('/', '', () => { throw new Error('blocked') })
    expect(r).toEqual({ login: null, theme: null })
  })
  it('reads the saved theme', () => {
    expect(earlyStart('/login', '', () => memStore({ theme: 'dark' })).theme).toBe('dark')
    expect(earlyStart('/login', '', () => memStore({ theme: 'light' })).theme).toBe('light')
    expect(earlyStart('/login', '', () => memStore()).theme).toBe(null)
  })
})

describe('markLoggedIn: the hint any session leaves (the demo too)', () => {
  it('a session marks the device; the demo reset (clearFastStart) keeps the mark', () => {
    const s = memStore(); markLoggedIn(s, true); clearFastStart(s)
    expect(earlyStart('/', '', () => s).login).toBe(null)
    expect(likelyLoggedIn(s)).toBe(true)
  })
  it('Log out / no session removes it', () => {
    const s = memStore(); markLoggedIn(s, true); markLoggedIn(s, false)
    expect(earlyStart('/near', '', () => s).login).toBe('/login?next=%2Fnear')
    expect(likelyLoggedIn(s)).toBe(false)
  })
  it('never throws on blocked storage', () => {
    expect(() => markLoggedIn({ setItem() { throw new Error('x') }, removeItem() { throw new Error('x') } }, true)).not.toThrow()
    expect(() => markLoggedIn(null, false)).not.toThrow()
  })
})

describe('likelyLoggedIn', () => {
  it('is true only with the logged-in hint', () => {
    expect(likelyLoggedIn(loggedIn())).toBe(true)
    expect(likelyLoggedIn(memStore())).toBe(false)
    expect(likelyLoggedIn(null)).toBe(false)
  })
})

describe('EARLY_START_SCRIPT (inlined in the page head)', () => {
  const run = (pathname, store) => {
    const html = { dataset: {} }, moved = []
    const location = { pathname, search: '', replace: u => moved.push(u) }
    new Function('location', 'localStorage', 'document', EARLY_START_SCRIPT)(location, store, { documentElement: html })
    return { moved, theme: html.dataset.theme }
  }
  it('runs on its own: sets the theme and makes the login hop', () => {
    expect(run('/near', memStore({ theme: 'dark' }))).toEqual({ moved: ['/login?next=%2Fnear'], theme: 'dark' })
  })
  it('stays put when logged in, and leaves the theme alone when none is saved', () => {
    expect(run('/', loggedIn())).toEqual({ moved: [], theme: undefined })
  })
})
