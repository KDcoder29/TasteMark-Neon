// What the page head does before any app code loads (EARLY_START_SCRIPT, inlined in app/layout.jsx):
//  - applies the saved theme, so /login doesn't flash light for a dark-mode user
//  - sends a visitor with nobody logged in on this device straight to /login, instead of loading the
//    whole app first only for the session gate to send them there (a wrong guess corrects itself:
//    /login goes on to the app when there is a session, and the gate still checks every start)
// earlyStart is inlined as source, so it must not use anything from outside its own body.
export function earlyStart(pathname, search, getStore) {
  let store
  try { store = getStore() } catch { return { login: null, theme: null } }
  const read = k => { try { return store.getItem(k) } catch { return null } }
  const t = read('theme')
  const theme = t === 'dark' || t === 'light' ? t : null
  // the signed-in app's addresses: everything except the logged-out pages, the share target, the
  // install page (sent to friends who have no account yet) and the API
  const outside = /^\/(login|reset-password|share|install|api)(\/|$)/.test(pathname)
  // 'bm.in' = a session was seen on this device (markLoggedIn below; the demo too); 'bm.snap.user' = who
  // is logged in here (lib/fastStart rememberUser), for devices from before 'bm.in'. Both go on Log out.
  if (outside || read('bm.in') || read('bm.snap.user')) return { login: null, theme }
  // same address as loginHref (lib/nextPath) gives the session gate
  const here = (pathname || '/') + (search || '')
  return { login: here === '/' ? '/login' : '/login?next=' + encodeURIComponent(here), theme }
}

export const EARLY_START_SCRIPT = `(function(){try{var r=(${earlyStart.toString()})(location.pathname,location.search,function(){return localStorage});` +
  `if(r.theme)document.documentElement.dataset.theme=r.theme;if(r.login)location.replace(r.login)}catch(e){}})()`

// someone is (most likely) logged in on this device: the /share page's quick guess, no network trip
export function likelyLoggedIn(store) {
  try { return !!(store?.getItem('bm.in') || store?.getItem('bm.snap.user')) } catch { return false }
}

// AppProvider: a session (any account, the demo too) sets the mark; "no session" and Log out remove it
export function markLoggedIn(store, yes) {
  try { if (yes) store.setItem('bm.in', '1'); else store.removeItem('bm.in') } catch {}
}
