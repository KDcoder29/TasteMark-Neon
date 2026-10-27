import { describe, expect, test } from 'vitest'
import { rememberLogin, recallEmail, saveJournal, loadJournal, clearFastStart, rememberUser, recallUser } from './fastStart'

const store = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i] ?? null, get length() { return m.size }, _m: m } }

describe('login memory (skips the username -> email lookup next time)', () => {
  test('recalls the email for a username, ignoring case', () => {
    const s = store()
    rememberLogin(s, 'Kandarp', 'k@example.com')
    expect(recallEmail(s, 'kandarp')).toBe('k@example.com')
    expect(recallEmail(s, 'someone')).toBe(null)
  })

  test('does nothing for email logins (no lookup needed anyway)', () => {
    const s = store()
    rememberLogin(s, 'k@example.com', 'k@example.com')
    expect(s.length).toBe(0)
  })

  test('survives a broken or missing storage', () => {
    expect(recallEmail(null, 'kandarp')).toBe(null)
    const bad = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    expect(() => rememberLogin(bad, 'a', 'b')).not.toThrow()
    expect(recallEmail(bad, 'a')).toBe(null)
  })
})

describe('journal snapshot (shown instantly, refreshed in the background)', () => {
  const data = { places: [{ id: 'p1', name: 'Raja Omlet' }], wishlist: [], names: {} }

  test('gives back what was saved for the same person and space', () => {
    const s = store()
    saveJournal(s, 'u1', 'personal', data)
    expect(loadJournal(s, 'u1', 'personal')).toEqual(data)
  })

  test('never shows one person\'s journal to another, or one space in another', () => {
    const s = store()
    saveJournal(s, 'u1', 'personal', data)
    expect(loadJournal(s, 'u2', 'personal')).toBe(null)
    expect(loadJournal(s, 'u1', 'g1')).toBe(null)
  })

  test('ignores a corrupted snapshot', () => {
    const s = store()
    saveJournal(s, 'u1', 'personal', data)
    for (const k of s._m.keys()) s.setItem(k, '{not json')
    expect(loadJournal(s, 'u1', 'personal')).toBe(null)
  })

  test('log out clears every journal snapshot, keeps the login memory (that is what speeds up the next login) and other settings', () => {
    const s = store()
    s.setItem('theme', 'dark')
    rememberLogin(s, 'Kandarp', 'k@example.com')
    saveJournal(s, 'u1', 'personal', data)
    saveJournal(s, 'u1', 'g1', data)
    clearFastStart(s)
    expect(loadJournal(s, 'u1', 'personal')).toBe(null)
    expect(loadJournal(s, 'u1', 'g1')).toBe(null)
    expect(recallEmail(s, 'kandarp')).toBe('k@example.com')
    expect(s.getItem('theme')).toBe('dark')
  })
})

describe('who is logged in on this device (opens the journal when the login server is unreachable)', () => {
  test('remembers only the id and email', () => {
    const s = store()
    rememberUser(s, { id: 'u1', email: 'k@example.com', name: 'Kandarp', token: 'secret' })
    expect(recallUser(s)).toEqual({ id: 'u1', email: 'k@example.com', username: '' })
    expect(s._m.get('bm.snap.user')).not.toMatch(/secret/)
  })

  test('nothing remembered, or junk stored: null', () => {
    const s = store()
    expect(recallUser(s)).toBe(null)
    s.setItem('bm.snap.user', '{broken')
    expect(recallUser(s)).toBe(null)
  })

  test('log out forgets it, so an offline start then shows the login page', () => {
    const s = store()
    rememberUser(s, { id: 'u1', email: 'k@example.com' })
    clearFastStart(s)
    expect(recallUser(s)).toBe(null)
  })
})

test('the username is remembered too, so "Hi, Kandarp" shows at once', () => {
  const s = store()
  rememberUser(s, { id: 'u1', email: 'k@example.com' }, 'Kandarp')
  expect(recallUser(s)).toEqual({ id: 'u1', email: 'k@example.com', username: 'Kandarp' })
  rememberUser(s, { id: 'u1', email: 'k@example.com' })              // no name given: keeps the known one
  expect(recallUser(s).username).toBe('Kandarp')
})
