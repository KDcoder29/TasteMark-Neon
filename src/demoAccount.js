// The public demo accounts: "Try the demo" on the login page (= Demo / demo1234 typed in), and the
// older test / test1234. Each is shared by everyone, so it starts fresh each visit and resets on log
// out: the database function reset_demo() (db/migrations/2026-10-29-demo-account.sql) puts the
// sample journal back. The passwords are public on purpose.

export const DEMO = { username: 'Demo', password: 'demo1234', email: 'demo.user@example.com' }
export const DEMO_EMAILS = [DEMO.email, 'demo@example.com']      // keep in sync with db/demo/build-demo-sql.mjs

export const isDemoUser = user => DEMO_EMAILS.includes((user?.email || '').toLowerCase())

// "this visit already got a fresh demo" lives in sessionStorage: a reload keeps your changes,
// a new visit (new tab, or after log out) starts fresh
const KEY = 'bm.demo.ready'
export function demoNeedsReset(s, uid) { try { return s?.getItem(KEY) !== uid } catch { return true } }
export function markDemoReady(s, uid) { try { s?.setItem(KEY, uid) } catch {} }
export function forgetDemoReady(s) { try { s?.removeItem(KEY) } catch {} }
