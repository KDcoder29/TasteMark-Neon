// Safe "where to go after login" handling (the ?next= query of /login). Only same-site paths are kept,
// so a crafted link can't send a freshly logged-in user to another site (open redirect).
export function safeNext(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/'
  if (value.startsWith('//') || /[\x00-\x1f\x5c]/.test(value) || /%5c/i.test(value)) return '/'
  if (value === '/login' || value.startsWith('/login?') || value.startsWith('/login#')) return '/'
  return value
}

// the login address for a logged-out visitor of `pathname + search` (home needs no next)
export function loginHref(pathname, search = '') {
  const here = (pathname || '/') + (search || '')
  return here === '/' ? '/login' : '/login?next=' + encodeURIComponent(here)
}
