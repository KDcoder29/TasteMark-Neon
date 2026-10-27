// The public demo account ("Try the demo" on the login page, or test / test1234 typed in).
// It's shared by everyone, so it starts fresh each visit and resets on log out: the database
// function reset_demo() (db/migrations/2026-10-29-demo-account.sql) puts the sample journal back.
// The password is public on purpose.

export const DEMO = { username: 'test', password: 'test1234', email: 'demo@example.com' }

export const isDemoUser = user => (user?.email || '').toLowerCase() === DEMO.email

// "this visit already got a fresh demo" lives in sessionStorage: a reload keeps your changes,
// a new visit (new tab, or after log out) starts fresh
const KEY = 'bm.demo.ready'
export function demoNeedsReset(s, uid) { try { return s?.getItem(KEY) !== uid } catch { return true } }
export function markDemoReady(s, uid) { try { s?.setItem(KEY, uid) } catch {} }
export function forgetDemoReady(s) { try { s?.removeItem(KEY) } catch {} }
