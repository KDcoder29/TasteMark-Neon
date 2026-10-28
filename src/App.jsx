import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Journal from './Journal'
import ChangePassword from './ChangePassword'
import ResetPassword from './ResetPassword'
import Groups from './Groups'
import Logo from './Logo'
import Icon from './Icons'
import AddMenu from './AddMenu'
import { tint } from './shared'
import { clearFastStart, rememberUser, recallUser } from './fastStart'
import { isDemoUser, demoNeedsReset, markDemoReady, forgetDemoReady } from './demoAccount'
import { askConfirm } from './dialogs'

const sessionStore = (() => { try { return window.sessionStorage } catch { return null } })()
import StoryCard from './StoryCard'
import Tour from './Tour'
import FeatureGuide from './FeatureGuide'
import DemoVideo from './DemoVideo'
import { shouldAutoTour, tourSeen, markTourSeen } from './tourPlan'
import { useSheetDrag, buzz } from './useGestures'
import { useEscape, useScrollLock } from './layers'

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

// Account details + settings: a dropdown on laptops, a sheet from the "You" tab on phones.
function AccountPanel({ email, username, dark, setDark, onPassword, onLogout, onDone, onGuide, story, demo }) {
  return (
    <>
      <div className="flex items-center gap-3 px-3 pb-3 pt-2">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg font-bold" style={{ background: 'var(--pri-soft)', color: 'var(--pri)' }}>
          {(username || email || '?')[0].toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="truncate font-semibold">{username ? `@${username}` : email}</div>
          {username && <div className="truncate text-xs" style={{ color: 'var(--mute)' }}>{email}</div>}
        </div>
      </div>
      {story}
      <div className="my-1 h-px" style={{ background: 'var(--line)' }} />
      <button className="menu-item" onClick={() => setDark(!dark)} role="switch" aria-checked={dark}>
        <span className="flex items-center gap-2.5"><Icon name={dark ? 'moon' : 'sun'} size={18} /> Dark mode</span>
        <span className={`switch ${dark ? 'on' : ''}`} />
      </button>
      {demo ? (
        // the demo is shared by everyone: one visitor must not lock the others out
        <p className="m-0 flex items-center gap-2.5 px-3 py-2.5 text-[13px]" style={{ color: 'var(--mute)' }}>
          <Icon name="key" size={18} /> Password can’t be changed in the demo
        </p>
      ) : (
        <button className="menu-item" onClick={() => { onDone(); onPassword() }}>
          <span className="flex items-center gap-2.5"><Icon name="key" size={18} /> Change password</span>
        </button>
      )}
      <button className="menu-item" onClick={() => { onDone(); onGuide() }}>
        <span className="flex items-center gap-2.5"><Icon name="help" size={18} /> How BiteMark works</span>
      </button>
      <div className="my-1 h-px" style={{ background: 'var(--line)' }} />
      <button className="menu-item" style={{ color: 'var(--bad)' }} onClick={() => { onDone(); onLogout() }}>
        <span className="flex items-center gap-2.5"><Icon name="logout" size={18} /> Log out</span>
      </button>
    </>
  )
}

// laptops: the account dropdown above your name (as wide as the sidebar, so it is never cut off)
function AccountMenu({ onClose, children }) {
  useEscape(onClose)
  return <div className="menu !bottom-[calc(100%+8px)] !left-0 !right-0 !top-auto !w-auto">{children}</div>
}

// a bottom sheet for phones (spaces, account)
function Sheet({ title, onClose, children }) {
  const drag = useSheetDrag(onClose)
  useEscape(onClose)
  useScrollLock()
  return (
    <>
      <div className="scrim" onMouseDown={onClose} />
      <div ref={drag} className="drawer !max-h-[80vh] lg:!top-auto lg:!bottom-auto" role="dialog" aria-label={title}>
        <div className="grabber" />
        <div className="flex items-center justify-between px-5 pb-1 pt-2">
          <h2 className="m-0 text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="ghost grid h-9 w-9 place-items-center rounded-full" style={{ color: 'var(--mute)' }}><Icon name="x" size={18} /></button>
        </div>
        <div className="overflow-y-auto px-2 pb-6">{children}</div>
      </div>
    </>
  )
}

export default function App() {
  if (window.location.pathname.startsWith('/reset-password')) return <ResetPassword />
  const [session, setSession] = useState(undefined)
  const [dark, setDark] = useTheme()
  const loggedOut = useRef(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [groups, setGroups] = useState([])
  const [groupsReady, setGroupsReady] = useState(false)
  const [groupsKnown, setGroupsKnown] = useState(false)   // the list really came from the server
  const [space, setSpace] = useState(() => {
    try { return localStorage.getItem('space') || 'personal' } catch { return 'personal' }
  })
  const uid = session?.user?.id
  const isDemo = isDemoUser(session?.user)
  // last known username on this device, so "Hi, Kandarp" shows at once (checked against uid below)
  const [username, setUsername] = useState(() => { try { return recallUser(window.localStorage)?.username || '' } catch { return '' } })
  const [view, setView] = useState('journal')            // journal | wishlist | activity | near
  const [adding, setAdding] = useState(false)             // + menu open
  const [addIntent, setAddIntent] = useState(null)        // { file? } -> Journal opens the place form
  const [sheet, setSheet] = useState(null)                // phones: 'spaces' | 'you'
  const [acctOpen, setAcctOpen] = useState(false)         // laptops: account dropdown
  const [stats, setStats] = useState({ places: 0, wish: 0, story: null, ready: false })
  const [help, setHelp] = useState(null)                  // 'tour' | 'guide' | 'video'
  const acctRef = useRef(null)
  const desktop = useDesktop()
  const uid0 = session?.user?.id

  // a brand-new account (empty journal, nothing to try) gets the 1-minute tour once, by itself
  useEffect(() => {
    if (!uid0 || space !== 'personal' || isDemo) return      // the demo offers the tour in its welcome popup
    const store = (() => { try { return window.localStorage } catch { return null } })()
    if (shouldAutoTour({ ...stats, seen: tourSeen(store, uid0) })) { markTourSeen(store, uid0); setHelp('tour') }
  }, [uid0, space, stats.ready, stats.places, stats.wish])

  // App start. No connection to the login server (it throws "Failed to fetch") is NOT "logged out":
  // whoever is logged in on this device gets their saved journal (with a "No connection" banner),
  // and we check again when the connection is back. Only a real "no session" answer shows Login.
  const settled = useRef(false)       // the first session check has answered (or failed)
  const offline = useRef(false)       // running from this device because the server was unreachable
  useEffect(() => {
    const store = (() => { try { return window.localStorage } catch { return null } })()
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
    setGroups(list)
    setGroupsKnown(true)
    setGroupsReady(true)
    return list
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
      setSpace('personal'); try { localStorage.setItem('space', 'personal') } catch {}
      loadGroups()
      setDemoBusy(false)
      if (error) console.error(error)
      return askConfirm({
        title: 'Welcome to the BiteMark demo',
        message: 'This is a shared sample journal with 72 places in Vadodara and Ahmedabad. Add, edit and delete anything you like: nothing you change is kept. The demo resets when you log out.',
        confirmLabel: 'Play the tour', cancelLabel: 'Explore on my own',
      }).then(tour => { if (tour) setHelp('tour') })
    })
  }, [demoWaiting, demoBusy])

  useEffect(() => {
    if (!uid) { if (session === null) setUsername(''); return }   // undefined = still checking: keep the remembered name
    const store = (() => { try { return window.localStorage } catch { return null } })()
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

  useEffect(() => {
    if (!acctOpen) return
    const close = e => { if (!acctRef.current?.contains(e.target)) setAcctOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [acctOpen])

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
    setSession(null); setGroups([]); setGroupsReady(false); setUsername(''); setGroupsOpen(false)
    window.location.replace('/')   // fresh start: nothing from the old session is left in memory
  }

  const chooseSpace = id => {
    setSpace(id)
    setView('journal')
    try { localStorage.setItem('space', id) } catch {}
  }

  // If someone removes you from a group, it disappears from your app too:
  // re-check your memberships when you return to the tab and every 15 seconds.
  useEffect(() => {
    if (!uid) return
    const refresh = () => { if (document.visibilityState === 'visible') loadGroups() }
    const t = setInterval(refresh, 15000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh) }
  }, [uid, loadGroups])

  // the open space no longer exists in my groups (removed / group deleted) -> go back to Personal
  useEffect(() => {
    if (groupsKnown && space !== 'personal' && !groups.some(g => g.id === space)) chooseSpace('personal')
  }, [groupsKnown, groups, space])

  // after create / join / leave / delete: refresh and jump to the new group if there is one
  async function groupsChanged(newId) {
    const list = await loadGroups()
    if (!list) return                                  // couldn't load: change nothing
    if (newId && list.some(g => g.id === newId)) chooseSpace(newId)
    else if (!list.some(g => g.id === space)) chooseSpace('personal')
  }

  if (session === undefined) return <div className="p-10"><div className="skel mx-auto max-w-md" /></div>
  if (session && demoWaiting) return (
    <div className="demo-wait">
      <div>
        <div className="scanbar mx-auto mb-4 w-40" aria-hidden="true" />
        <p className="m-0 font-semibold">Setting up the demo journal…</p>
        <p className="m-0 mt-1 text-sm" style={{ color: 'var(--mute)' }}>72 places in Vadodara and Ahmedabad</p>
      </div>
    </div>
  )
  if (!session) return <Login onSession={s => { loggedOut.current = false; setSession(s) }} />

  const activeGroup = groups.find(g => g.id === space) || null
  const pickAdd = intent => { setAdding(false); setView('journal'); setAddIntent(intent) }
  const go = v => { setView(v); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const account = { email: session.user.email, username, dark, setDark, onPassword: () => setPwOpen(true), onLogout: logout, onGuide: () => setHelp('guide'), demo: isDemo }

  // "Try it" in the Feature guide: open the real thing
  const tryIt = action => {
    setHelp(null)
    const focusSearch = () => setTimeout(() => document.querySelector('.searchbar input')?.focus(), 350)
    switch (action) {
      case 'add': go('journal'); setAdding(true); break
      case 'voice': pickAdd({ voice: true }); break
      case 'manual': pickAdd({}); break
      case 'search': go('journal'); focusSearch(); break
      case 'filters': go('journal'); setAddIntent({ tool: 'filters' }); break
      case 'craving': setAddIntent({ tool: 'craving' }); break
      case 'picker': setAddIntent({ tool: 'picker' }); break
      case 'wishlist': go('wishlist'); break
      case 'near': go('near'); break
      case 'groups': setGroupsOpen(true); break
      case 'you': if (desktop) setAcctOpen(true); else setSheet('you'); break
      case 'dark': setDark(!dark); break
    }
  }
  const tourDone = next => {
    setHelp(next === 'guide' ? 'guide' : null)
    if (next === 'add') { go('journal'); setAdding(true) }
  }

  const spaceList = (onPicked = () => {}) => (
    <>
      <button className={`side-item ${!activeGroup ? 'on' : ''}`} onClick={() => { chooseSpace('personal'); onPicked() }}>
        <Icon name="user" size={18} /> Personal
      </button>
      {groups.map(g => (
        <button key={g.id} className={`side-item ${activeGroup?.id === g.id ? 'on' : ''}`} onClick={() => { chooseSpace(g.id); onPicked() }}>
          <span className="grid h-[18px] w-[18px] place-items-center rounded-md text-[10px] font-bold text-white" style={{ background: tint(g.id) }}>{g.name[0].toUpperCase()}</span>
          <span className="truncate">{g.name}</span>
        </button>
      ))}
      <button className="side-item" style={{ color: 'var(--pri)' }} onClick={() => { onPicked(); setGroupsOpen(true) }}>
        <Icon name="plus" size={18} /> New or join a group
      </button>
    </>
  )

  return (
    <div className="shell">
      {/* ---------- laptop sidebar ---------- */}
      <aside className="sidebar" aria-label="Main">
        <div className="mb-3 flex items-center gap-2.5 px-2">
          <Logo size={38} />
          <div className="leading-tight">
            <div className="text-[17px] font-extrabold tracking-tight">BiteMark</div>
            <div className="text-xs" style={{ color: 'var(--mute)' }}>Remember every great bite</div>
          </div>
        </div>
        <div className="side-h">SPACES</div>
        {spaceList()}
        <div className="side-h">BROWSE</div>
        <button className={`side-item ${view === 'journal' ? 'on' : ''}`} onClick={() => go('journal')}>
          <Icon name="home" size={18} /> Places <span className="count">{stats.places || ''}</span>
        </button>
        <button className={`side-item ${view === 'wishlist' ? 'on' : ''}`} onClick={() => go('wishlist')}>
          <Icon name="bookmark" size={18} /> Want to try <span className="count">{stats.wish || ''}</span>
        </button>
        <button className={`side-item ${view === 'near' ? 'on' : ''}`} onClick={() => go('near')}>
          <Icon name="locate" size={18} /> Near me
        </button>
        {activeGroup && (
          <button className={`side-item ${view === 'activity' ? 'on' : ''}`} onClick={() => go('activity')}>
            <Icon name="activity" size={18} /> Activity
          </button>
        )}
        <div className="side-h">ASK BITEMARK</div>
        <button className="side-item" onClick={() => setAddIntent({ tool: 'craving' })}><Icon name="chat" size={18} /> Craving something?</button>
        <button className="side-item" onClick={() => setAddIntent({ tool: 'picker' })}><Icon name="dice" size={18} /> {activeGroup ? 'Where should we eat?' : 'Where to eat?'}</button>
        <button className="side-item" onClick={() => setHelp('guide')}><Icon name="help" size={18} /> How BiteMark works</button>

        <div ref={acctRef} className="relative mt-auto pt-4">
          {acctOpen && (
            <AccountMenu onClose={() => setAcctOpen(false)}>
              <AccountPanel {...account} onDone={() => setAcctOpen(false)} story={<StoryCard story={stats.story} space={activeGroup ? activeGroup.name : 'Personal'} />} />
            </AccountMenu>
          )}
          <button className="side-item" onClick={() => setAcctOpen(!acctOpen)} aria-label="Account menu" aria-expanded={acctOpen}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold" style={{ background: 'var(--pri-soft)', color: 'var(--pri)' }}>
              {(username || session.user.email || '?')[0].toUpperCase()}
            </span>
            <span className="min-w-0 truncate">{username ? `@${username}` : session.user.email}</span>
            <Icon name="down" size={16} className="ml-auto" />
          </button>
        </div>
      </aside>

      {/* ---------- content ---------- */}
      <div className="min-w-0">
        {isDemo && (
          <div className="demobar" role="note">
            <span>Demo account: changes reset when you log out.</span>
            <button onClick={logout}>Log out</button>
          </div>
        )}
        <header className="topbar mobile-only">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <Logo size={34} />
              <button onClick={() => setSheet('spaces')} className="flex min-w-0 items-center gap-1 text-left" aria-label="Switch space">
                <span className="leading-tight">
                  <span className="block text-[11px] font-semibold" style={{ color: 'var(--mute)' }}>BiteMark</span>
                  <span className="flex items-center gap-1 truncate text-[16px] font-extrabold">
                    {activeGroup ? activeGroup.name : 'Personal'} <Icon name="down" size={15} stroke={2.6} />
                  </span>
                </span>
              </button>
            </div>
            <span className="flex items-center">
              <button onClick={() => setHelp('guide')} aria-label="How BiteMark works"
                className="ghost grid h-10 w-10 place-items-center rounded-full" style={{ color: 'var(--mute)' }}>
                <Icon name="help" size={21} />
              </button>
              <button onClick={() => setDark(!dark)} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="ghost grid h-10 w-10 place-items-center rounded-full" style={{ color: 'var(--mute)' }}>
                <Icon name={dark ? 'sun' : 'moon'} size={20} />
              </button>
            </span>
          </div>
        </header>

        <main className="main">
          <div className="wrap">
            {/* Personal doesn't need the groups list first: start loading it right away */}
            {groupsReady || space === 'personal'
              ? <Journal key={activeGroup?.id || 'personal'} me={uid} group={activeGroup} groups={groups} username={username}
                  view={view} setView={go} addIntent={addIntent} onIntentDone={() => setAddIntent(null)} onStats={setStats} onHelp={setHelp}
                  addButton={(
                    <div className="relative desktop-only">
                      <button data-addbtn className="btn btn-accent" onClick={() => setAdding(!adding)} aria-expanded={adding}>
                        <Icon name="plus" size={18} stroke={2.6} /> Add place
                      </button>
                      {adding && desktop && <AddMenu onPick={pickAdd} onClose={() => setAdding(false)} />}
                    </div>
                  )} />
              : <div className="space-y-3 pt-6"><div className="skel" /><div className="skel" /><div className="skel" /></div>}
          </div>
        </main>
      </div>

      {/* ---------- phone bottom bar ---------- */}
      <nav className="bottomnav" aria-label="Main" style={adding ? { zIndex: 42 } : null}>
        <button className={`navbtn ${!sheet && (view === 'journal' || view === 'activity' || view === 'near') ? 'on' : ''}`} onClick={() => go('journal')}><span className="navico"><Icon name="home" size={22} /></span>Home</button>
        <button className={`navbtn ${!sheet && view === 'wishlist' ? 'on' : ''}`} onClick={() => go('wishlist')}><span className="navico"><Icon name="bookmark" size={22} /></span>Want to try</button>
        <button data-addbtn className={`navplus ${adding ? 'open' : ''}`} onClick={() => { buzz(); setAdding(!adding) }} aria-label="Add" aria-expanded={adding}>
          <Icon name="plus" size={28} stroke={2.6} />
        </button>
        {/* inside a group this is the way home (the top-bar switcher was easy to miss);
            in Personal it opens your groups. A group's Activity lives on the group's own page. */}
        {activeGroup ? (
          <button className="navbtn" onClick={() => { chooseSpace('personal'); window.scrollTo({ top: 0 }) }}>
            <span className="navico"><Icon name="user" size={22} /></span>Personal
          </button>
        ) : (
          <button className={`navbtn ${sheet === 'spaces' ? 'on' : ''}`} onClick={() => setSheet('spaces')}><span className="navico"><Icon name="users" size={22} /></span>Groups</button>
        )}
        <button className={`navbtn ${sheet === 'you' ? 'on' : ''}`} onClick={() => setSheet('you')}>
          {/* your initial, like a profile photo — so it never looks like the "Personal" tab next to it */}
          <span className="navico"><span className="grid h-[22px] w-[22px] place-items-center rounded-full text-[11px] font-bold" style={{ background: 'var(--pri-soft)', color: 'var(--pri)', outline: '1.5px solid currentColor', outlineOffset: 1 }}>
            {(username || session.user.email || '?')[0].toUpperCase()}
          </span></span>You
        </button>
      </nav>
      {adding && !desktop && <AddMenu onPick={pickAdd} onClose={() => setAdding(false)} />}

      {sheet === 'spaces' && <Sheet title="Your spaces" onClose={() => setSheet(null)}>{spaceList(() => setSheet(null))}</Sheet>}
      {sheet === 'you' && <Sheet title="You" onClose={() => setSheet(null)}>
        <AccountPanel {...account} onDone={() => setSheet(null)} story={<StoryCard story={stats.story} space={activeGroup ? activeGroup.name : 'Personal'} />} />
      </Sheet>}

      {pwOpen && <ChangePassword onClose={() => setPwOpen(false)} />}
      {help === 'guide' && <FeatureGuide onClose={() => setHelp(null)} onTour={() => setHelp('tour')} onVideo={() => setHelp('video')} onTry={tryIt} />}
      {help === 'tour' && <Tour onDone={tourDone} />}
      {help === 'video' && <DemoVideo onClose={() => setHelp('guide')} />}
      {groupsOpen && <Groups me={uid} groups={groups} onClose={() => setGroupsOpen(false)}
        onChanged={groupsChanged} onOpen={chooseSpace} />}
    </div>
  )
}
