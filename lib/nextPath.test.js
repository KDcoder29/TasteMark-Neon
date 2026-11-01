import { describe, it, expect } from 'vitest'
import { safeNext, loginHref } from '@/lib/nextPath'

describe('safeNext', () => {
  it('keeps same-site paths, with query and hash', () => {
    expect(safeNext('/near')).toBe('/near')
    expect(safeNext('/g/abc/activity?x=1#top')).toBe('/g/abc/activity?x=1#top')
  })
  it('falls back to / for empty or missing values', () => {
    for (const v of [undefined, null, '', 5, {}]) expect(safeNext(v)).toBe('/')
  })
  it('rejects full URLs and protocol-relative addresses', () => {
    for (const v of ['//evil.com', '///evil.com', 'https://evil.com', 'http://evil.com/x', 'javascript:alert(1)', 'evil.com', 'near']) {
      expect(safeNext(v)).toBe('/')
    }
  })
  it('rejects backslash and control-character tricks', () => {
    for (const v of ['/\\evil.com', '/\t/evil.com', '/\n/evil.com', '\\/evil.com', '/%5Cevil.com']) expect(safeNext(v)).toBe('/')
  })
  it('does not bounce back to the login page', () => {
    expect(safeNext('/login')).toBe('/')
    expect(safeNext('/login?next=%2Fnear')).toBe('/')
  })
})

describe('loginHref', () => {
  it('adds the address as next', () => {
    expect(loginHref('/near', '')).toBe('/login?next=%2Fnear')
    expect(loginHref('/g/a', '?v=1')).toBe('/login?next=%2Fg%2Fa%3Fv%3D1')
  })
  it('is plain /login for the home address', () => {
    expect(loginHref('/', '')).toBe('/login')
  })
})
