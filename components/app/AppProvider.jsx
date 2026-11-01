'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSelectedLayoutSegments } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { clearFastStart, rememberUser, recallUser, saveGroups, savedGroups } from '@/lib/fastStart'
import { markLoggedIn } from '@/lib/earlyStart'
import { isDemoUser, demoNeedsReset, markDemoReady, forgetDemoReady } from '@/lib/demoAccount'
import { askConfirm } from '@/lib/dialogs'
import { takeShare } from '@/lib/shareTarget'
import { shouldAutoTour, tourSeen, markTourSeen } from '@/lib/tourPlan'
import { parsePath, spaceBase, spaceFromSegments, viewHref, groupsChangeTarget, currentGroup } from '@/lib/routes'

// App-wide state (was App.jsx): session, profile, groups, theme, the help overlays, the + menu and its
// intent, the app sheets, the demo flow and the share-target take. The shell (app/(app)/layout.jsx)
// and every screen read it with useApp(). The current space and view come from the address (lib/routes).

const sessionStore = (() => { try { return window.sessionStorage } catch { return null } })()
const localStore = () => { try { return window.localStorage } catch { return null } }

const AppContext = createContext(null)
export function useApp() {
  const app = useContext(AppContext)
  if (!app) throw new Error('useApp() must be used inside <AppProvider>')
  return app
}

function useTheme() {
  const [dark, setDark] = useState(() => {
    try { const t = localStorage.getItem('theme'); if (t) return t === 'dark' } catch {}
    return false // light by default; the toggle remembers your choice
  })
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    try { localStorage.setItem('theme', dark ? 'dark' : 'light') } catch {}
  }, [dark])
  return [dark, setDark]
}

// laptop vs phone layout; only things that must not exist twice (the + menu) depend on it — the rest is CSS
function useDesktop() {
  const q = '(min-width: 1024px)'
  const [on, setOn] = useState(() => window.matchMedia?.(q).matches ?? false)
  useEffect(() => {
    const m = window.matchMedia(q), f = () => setOn(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return on
}

export default function AppProvider({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const route = parsePath(pathname)                        // the address: placeId and sheet (Task 3)
  // The view (journal | wishlist | activity | near) comes from the page in the children slot: under the
  // place sheet and the Groups / You sheets (pushed with the browser's history) it stays put. The open
  // group (null = Personal) comes from the address: every group shares one prebuilt page (/g/_).
  const { view } = spaceFromSegments(useSelectedLayoutSegments())
  const lastGroup = useRef(null)
  const groupId = currentGroup(pathname, lastGroup.current)
  lastGroup.current = groupId
  const pathRef = useRef(pathname)
  pathRef.current = pathname
  const groupRef = useRef(groupId)
  groupRef.current = groupId

  const [session, setSession] = useState(undefined)
  const [dark, setDark] = useTheme()
  const loggedOut = useRef(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [groups, setGroups] = useState([])
  const [groupsReady, setGroupsReady] = useState(false)
  const [groupsKnown, setGroupsKnown] = useState(false)   // the list really came from the server
  // "remember the space": opening / after last using a group goes to that group, once, at app start
  const [startSpace, setStartSpace] = useState(() => {
    if (pathname !== '/') return null
    try { const s = localStorage.getItem('space'); return s && s !== 'personal' ? s : null } catch { return null }
  })
  const uid = session?.user?.id
  const isDemo = isDemoUser(session?.user)
  // last known username on this device, so "Hi, Kandarp" shows at once (checked against uid below)
  const [username, setUsername] = useState(() => { try { return recallUser(window.localStorage)?.username || '' } catch { return '' } })
  const [adding, setAdding] = useState(false)             // + menu open
  const [addIntent, setAddIntent] = useState(null)        // { file? } -> the space opens the place form
  const [spacesSheet, setSpacesSheet] = useState(null)    // phones: 'spaces' (state); 'you' and Groups come from the address
  // The Groups and You sheets are routes (/groups, /you). openGroups / openYou push the address and
  // remember it was opened in-app, so closing is Back; a direct load or a refresh has nothing to go back to.
  const sheetInApp = useRef(false)
  const sheetClosing = useRef(false)    // a close (or a switch into a group) is already under way
  const pendingSpace = useRef(null)     // a group created / joined in the Groups sheet: opened once the sheet closes
  useEffect(() => {
    if (route.sheet) return
    sheetInApp.current = false; sheetClosing.current = false
    const p = pendingSpace.current
    if (p) { pendingSpace.current = null; chooseSpace(p) }
  }, [route.sheet])
  const groupsOpen = route.sheet === 'groups'
  const sheet = route.sheet === 'you' ? 'you' : spacesSheet
  const setSheet = v => { if (v) setSpacesSheet(v); else { setSpacesSheet(null); if (route.sheet === 'you') closeSheet() } }
  const [acctOpen, setAcctOpen] = useState(false)         // laptops: account dropdown
  const [stats, setStats] = useState({ places: 0, wish: 0, story: null, ready: false })
  const [help, setHelp] = useState(null)                  // 'tour' | 'guide' | 'video'
  const desktop = useDesktop()
  const uid0 = session?.user?.id

  // a brand-new account (empty journal, nothing to try) gets the 1-minute tour once, by itself
  useEffect(() => {
    if (!uid0 || groupId || isDemo) return      // the demo offers the tour in its welcome popup
    const store = localStore()
    if (shouldAutoTour({ ...stats, seen: tourSeen(store, uid0) })) { markTourSeen(store, uid0); setHelp('tour') }
  }, [uid0, groupId, stats.ready, stats.places, stats.wish])

  // App start. No connection to the login server (it throws "Failed to fetch") is NOT "logged out":
  // whoever is logged in on this device gets their saved journal (with a "No connection" banner),
  // and we check again when the connection is back. Only a real "no session" answer shows Login.
  const settled = useRef(false)       // the first session check has answered (or failed)
  const offline = useRef(false)       // running from this device because the server was unreachable
  useEffect(() => {
    const store = localStore()
    let retry = null
    const check = () => supabase.auth.getSession()
      .then(({ data }) => {
        settled.current = true; offline.current = false; clearInterval(retry); retry = null
        setSession(data.session)
      })
      .catch(() => {
        settled.current = true
        const u = recallUser(store)
        if (!u) return setSession(null)
        offline.current = true
        setSession(s => s || { user: u, offline: true })
        if (!retry) retry = setInterval(check, 15000)
      })
    check()
    const online = () => { if (offline.current) check() }
    window.addEventListener('online', online)
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (loggedOut.current && s) return          // after Log out, a late "signed in" can't bring the old session back
      if (!s && (!settled.current || offline.current)) return   // "no session" only because the server was unreachable
      setSession(s)
    })
    return () => { sub.subscription.unsubscribe(); clearInterval(retry); window.removeEventListener('online', online) }
  }, [])

  // the page head's early hop to /login (lib/earlyStart) skips devices with a session, the demo's too
  useEffect(() => {
    if (session === null) markLoggedIn(localStore(), false)
    else if (session?.user) markLoggedIn(localStore(), true)
  }, [session === null, !!session?.user])

  // remember who is logged in here (id + email), for the offline start above
  useEffect(() => {
    if (session?.user?.id && !session.offline) { try { rememberUser(window.localStorage, session.user) } catch {} }
  }, [session?.user?.id])

  const loadGroups = useCallback(async () => {
    if (!uid) return []
    const { data, error } = await supabase
      .from('group_members')
      .select('role, groups(id, name, invite_code, owner_id)')
      .eq('user_id', uid)
      .order('joined_at')
    // a failed load (no connection) shows the page, but must never be read as "you're in no groups"
    if (error) { console.error(error); setGroupsReady(true); return null }
    const list = (data || []).filter(r => r.groups).map(r => ({ ...r.groups, role: r.role }))
    saveGroups(localStore(), uid, list)
    setGroups(list)
    setGroupsKnown(true)
    setGroupsReady(true)
    return list
  }, [uid])

  // the group names at once, from this device (refreshed by loadGroups right below)
  useEffect(() => {
    const saved = uid && savedGroups(localStore(), uid)
    if (saved) setGroups(g => (g.length ? g : saved))
  }, [uid])
  // (again when the connection comes back after an offline start)
  useEffect(() => { setGroupsReady(false); loadGroups() }, [loadGroups, session?.offline])

  // The public demo: every visit starts from the sample journal (whatever the last visitor did), then
  // a popup says changes aren't kept. A reload in the same tab keeps your changes (sessionStorage).
  const [demoBusy, setDemoBusy] = useState(false)
  const demoWaiting = isDemo && !!uid && !session?.offline && demoNeedsReset(sessionStore, uid)
  useEffect(() => {
    if (!demoWaiting || demoBusy) return
    setDemoBusy(true)
    supabase.rpc('reset_demo').then(({ error }) => {
      if (error) console.error('Demo reset failed (is db/migrations/2026-10-29-demo-account.sql applied?)', error)
      markDemoReady(sessionStore, uid)
      try { clearFastStart(window.localStorage) } catch {}      // no snapshot of the last visitor's journal
      // the demo always starts in Personal
      setStartSpace(null); try { localStorage.setItem('space', 'personal') } catch {}
      if (parsePath(pathRef.current).groupId) router.replace('/')
      setGroupsReady(false); loadGroups()   // (the Groups sheet waits for the reset's groups)
      setDemoBusy(false)
      if (error) console.error(error)
      return askConfirm({
        title: 'Welcome to the BiteMark demo',
        message: 'This is a shared sample journal with 72 places in Vadodara and Ahmedabad. Add, edit and delete anything you like: nothing you change is kept. The demo resets when you log out.',
        confirmLabel: 'Play the tour', cancelLabel: 'Explore on my own',
      }).then(tour => { if (tour) setHelp('tour') })
    })
  }, [demoWaiting, demoBusy])

  // the remembered space: once signed in (and the demo is ready), / goes to the last group used
  useEffect(() => {
    if (!startSpace || !session || demoWaiting) return
    if (pathname === '/') router.replace(spaceBase(startSpace))
    else setStartSpace(null)                       // arrived (or the address changed meanwhile): done
  }, [startSpace, session, demoWaiting, pathname])
  const startPending = !!startSpace && pathname === '/'

  // a shared place waiting for us: once signed in (and the demo is ready), load what it could match
  const [share, setShare] = useState(null)               // { shared, candidates } -> ShareSheet
  const [shareToast, setShareToast] = useState('')
  const [shareRev, setShareRev] = useState(0)             // bumps to reload the journal after a saved spot
  useEffect(() => {
    if (!uid || demoWaiting) return
    const data = takeShare(sessionStore)
    if (!data) return
    const cols = 'id, name, city, area, loc_source, group_id'
    Promise.all([
      supabase.from('places').select(cols),
      supabase.from('wishlist').select(cols).is('went_at', null),
    ]).then(([p, w]) => setShare({
      data, loadError: !!(p.error || w.error),
      candidates: [...(p.data || []).map(x => ({ ...x, table: 'places' })), ...(w.data || []).map(x => ({ ...x, table: 'wishlist' }))],
    })).catch(() => setShare({ data, candidates: [], loadError: true }))
  }, [uid, demoWaiting])
  useEffect(() => { if (!shareToast) return; const t = setTimeout(() => setShareToast(''), 2600); return () => clearTimeout(t) }, [shareToast])

  useEffect(() => {
    if (!uid) { if (session === null) setUsername(''); return }   // undefined = still checking: keep the remembered name
    const store = localStore()
    if (recallUser(store)?.id !== uid) setUsername('')       // someone else's name must not show
    // read my username; only on the very first login is the profile row missing — then create it
    // from the sign-up name and read again (saves a US round trip on every other app start)
    const read = () => supabase.from('profiles').select('username').eq('id', uid).maybeSingle()
    // (a failed read, e.g. no connection, is not "missing": keep what we have and try when back online)
    read()
      .then(r => (r.error || r.data ? r : supabase.rpc('ensure_profile').then(read)))
      .then(({ data, error }) => {
        if (error) return
        setUsername(data?.username || '')
        rememberUser(store, { id: uid, email: session?.user?.email }, data?.username || '')
      })
  }, [uid, session?.offline])

  // sign out and go straight back to the login page (do not wait for an auth-change event)
  async function logout() {
    loggedOut.current = true
    try { clearFastStart(window.localStorage) } catch {}      // no journal snapshot stays on this device
    if (isDemo) {
      // the shared demo goes back to its sample journal (best effort: never more than 5 s)
      forgetDemoReady(sessionStore)
      await Promise.race([supabase.rpc('reset_demo'), new Promise(r => setTimeout(r, 5000))]).catch(() => {})
    }
    try { await supabase.auth.signOut() } catch (e) { console.error(e) }
    setSession(null); setGroups([]); setGroupsReady(false); setUsername('')
    markLoggedIn(localStore(), false)
    window.location.replace('/login')   // fresh start: nothing from the old session is left in memory
  }

  // Login answered with a session (the inline login screen of the session gate)
  const signedIn = s => { loggedOut.current = false; setSession(s) }

  // switch space: its address (Personal = /), remembered for the next app start
  // (the space items are Links that only remember the space: rememberSpace)
  const rememberSpace = id => { try { localStorage.setItem('space', id) } catch {} }
  const chooseSpace = id => {
    pendingSpace.current = null   // a group picked in the sheet wins over one waiting for the sheet to close
    rememberSpace(id)
    const href = spaceBase(id === 'personal' ? null : id) || '/'
    if (href === pathRef.current) return
    if (parsePath(pathRef.current).sheet) { sheetClosing.current = true; router.replace(href, { scroll: false }) }   // out of the Groups sheet: it must not stay in the history
    else router.push(href, { scroll: false })
  }

  // If someone removes you from a group, it disappears from your app too:
  // re-check your memberships when you return to the tab and every 15 seconds.
  // (The group space itself goes back to Personal when its group is gone: app/(app)/g/[groupId]/layout.jsx.)
  useEffect(() => {
    if (!uid) return
    const refresh = () => { if (document.visibilityState === 'visible') loadGroups() }
    const t = setInterval(refresh, 15000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh) }
  }, [uid, loadGroups])

  // after create / join / leave / delete: refresh and jump to the new group if there is one
  async function groupsChanged(newId) {
    const list = await loadGroups()
    if (!list) return                                  // couldn't load: change nothing
    const { go, pending } = groupsChangeTarget({ newId, open: groupRef.current, list, sheetOpen: !!parsePath(pathRef.current).sheet })
    if (go) chooseSpace(go)
    if (pending) { rememberSpace(pending); pendingSpace.current = pending }   // opened when the sheet closes (effect above)
  }

  const activeGroup = groups.find(g => g.id === groupId) || null
  // a view of the open space (was setView); no new history entry when it's already on screen.
  // replace: for a view change that comes with an overlay (+ menu, share, Feature guide), so the phone's
  // Back closes the overlay's screen instead of switching the view behind it
  const toView = (v, replace) => {
    const href = viewHref(v, groupId)
    if (href !== pathRef.current) router[replace ? 'replace' : 'push'](href, { scroll: false })
  }
  const go = (v, { replace = false } = {}) => { toView(v, replace); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const openAdd = intent => setAddIntent(intent)
  const clearIntent = () => setAddIntent(null)
  const pickAdd = intent => { setAdding(false); toView('journal', true); setAddIntent(intent) }
  const openSheet = name => {
    if (pathRef.current === '/' + name) return
    sheetInApp.current = true; sheetClosing.current = false
    window.history.pushState(null, '', '/' + name)   // no server trip: the sheet is drawn from the address
  }
  const openGroups = () => openSheet('groups')
  const openYou = () => openSheet('you')
  // Close the Groups / You sheet: Back when it was opened in-app, else to the open space's address.
  // Called again while a close or a switch into a group is under way, it does nothing.
  function closeSheet() {
    if (!parsePath(pathRef.current).sheet || sheetClosing.current) return
    sheetClosing.current = true
    if (sheetInApp.current) router.back()
    else router.replace(spaceBase(groupRef.current) || '/', { scroll: false })
  }

  // "Try it" in the Feature guide: open the real thing
  const tryIt = action => {
    setHelp(null)
    const focusSearch = () => setTimeout(() => document.querySelector('.searchbar input')?.focus(), 350)
    switch (action) {
      case 'add': go('journal'); setAdding(true); break
      case 'voice': pickAdd({ voice: true }); break
      case 'manual': pickAdd({}); break
      case 'search': go('journal'); focusSearch(); break
      case 'filters': go('journal', { replace: true }); setAddIntent({ tool: 'filters' }); break
      case 'craving': setAddIntent({ tool: 'craving' }); break
      case 'picker': setAddIntent({ tool: 'picker' }); break
      case 'wishlist': go('wishlist'); break
      case 'near': go('near'); break
      case 'groups': openGroups(); break
      case 'you': if (desktop) setAcctOpen(true); else openYou(); break
      case 'dark': setDark(!dark); break
    }
  }
  const tourDone = next => {
    setHelp(next === 'guide' ? 'guide' : null)
    if (next === 'add') { go('journal'); setAdding(true) }
  }

  const value = {
    // session and profile
    session, me: uid, isDemo, username, signedIn, logout, demoWaiting,
    // groups and spaces (groupId / view / route come from the address)
    groups, groupsReady, groupsKnown, loadGroups, groupsChanged, chooseSpace, rememberSpace, activeGroup, groupId, view, route, startPending,
    // theme and layout
    theme: dark ? 'dark' : 'light', dark, setDark, desktop,
    // help overlays
    help, setHelp, tryIt, tourDone,
    // the + menu and the intent the space acts on
    adding, setAdding, openAdd, pickAdd, addIntent, clearIntent,
    // navigation
    go,
    // the open space reports its numbers here (sidebar counts, food story, first-visit tour)
    stats, setStats,
    // app sheets
    sheet, setSheet, acctOpen, setAcctOpen, pwOpen, setPwOpen, groupsOpen, openGroups, openYou, closeSheet,
    // share target
    share, setShare, shareToast, setShareToast, shareRev, setShareRev,
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
