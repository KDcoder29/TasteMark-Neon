import { describe, expect, test } from 'vitest'
import { DEMO, DEMO_EMAILS, isDemoUser, demoNeedsReset, markDemoReady, forgetDemoReady, loginLabels } from './demoAccount'

const store = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) } }

describe('the public demo account', () => {
  test('"Try the demo" signs in as Demo / demo1234', () => {
    expect(DEMO.username).toBe('Demo')
    expect(DEMO.password).toBe('demo1234')
  })

  test('both demo logins (Demo, and the older test / test1234) are demo accounts', () => {
    expect(DEMO_EMAILS).toContain(DEMO.email)
    expect(DEMO_EMAILS).toContain('demo@example.com')
    for (const email of DEMO_EMAILS) expect(isDemoUser({ email })).toBe(true)
  })

  test('recognised by its email, any case; everyone else is not the demo', () => {
    expect(isDemoUser({ email: DEMO.email })).toBe(true)
    expect(isDemoUser({ email: DEMO.email.toUpperCase() })).toBe(true)
    expect(isDemoUser({ email: 'kandarp@example.com' })).toBe(false)
    expect(isDemoUser(null)).toBe(false)
  })

  test('the demo is reset once per visit (not on every reload), and again after log out', () => {
    const s = store()
    expect(demoNeedsReset(s, 'u1')).toBe(true)
    markDemoReady(s, 'u1')
    expect(demoNeedsReset(s, 'u1')).toBe(false)
    forgetDemoReady(s)
    expect(demoNeedsReset(s, 'u1')).toBe(true)
  })

  test('blocked storage: always reset (safe), never crash', () => {
    const bad = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') }, removeItem: () => { throw new Error('x') } }
    expect(demoNeedsReset(bad, 'u1')).toBe(true)
    expect(() => { markDemoReady(bad, 'u1'); forgetDemoReady(bad) }).not.toThrow()
  })
})

describe('login page buttons while one is working', () => {
  test('Try the demo: only the demo button shows progress; Log in keeps its label', () => {
    const l = loginLabels('demo', {})
    expect(l.main).toBe('Log in')
    expect(l.demo).toBe('Opening the demo…')
  })
  test('Log in: only Log in shows progress; the demo button keeps its label', () => {
    const l = loginLabels('form', {})
    expect(l.main).toBe('Please wait…')
    expect(l.demo).toBe('Try the demo')
  })
  test('idle labels follow the form mode', () => {
    expect(loginLabels(null, {}).main).toBe('Log in')
    expect(loginLabels(null, { isSignup: true }).main).toBe('Create account')
    expect(loginLabels(null, { forgot: true }).main).toBe('Send reset link')
    expect(loginLabels(null, {}).demo).toBe('Try the demo')
  })
})
