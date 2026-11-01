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

// Login page labels. busy is which button is working ('form' | 'demo' | null): both are disabled
// meanwhile, but only the one you pressed says so (Try the demo must not make Log in look busy).
export function loginLabels(busy, { forgot = false, isSignup = false } = {}) {
  return {
    main: busy === 'form' ? 'Please wait…' : forgot ? 'Send reset link' : isSignup ? 'Create account' : 'Log in',
    demo: busy === 'demo' ? 'Opening the demo…' : 'Try the demo',
  }
}

// The demo's reset, right after "Try the demo" / logging in as Demo. The very first request can go out
// before the login token is attached; the server then doesn't see a demo account ("only for the demo
// accounts") and the demo would keep the last visitor's changes. Try again (3 tries, wait between);
// any other error is returned at once. call() -> { error }; wait() -> a short pause.
export async function resetDemo(call, wait = () => new Promise(r => setTimeout(r, 1000))) {
  let r
  for (let i = 0; i < 3; i++) {
    if (i) await wait()
    r = await call()
    if (!r?.error || !/only for the demo accounts/.test(r.error.message || '')) return r
  }
  return r
}
