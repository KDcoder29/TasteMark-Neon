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
import { clearFastStart } from './fastStart'
import StoryCard from './StoryCard'
import { useSheetDrag, buzz } from './useGestures'

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
function AccountPanel({ email, username, dark, setDark, onPassword, onLogout, onDone, story }) {
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
      <button className="menu-item" onClick={() => { onDone(); onPassword() }}>
        <span className="flex items-center gap-2.5"><Icon name="key" size={18} /> Change password</span>
      </button>
      <div className="my-1 h-px" style={{ background: 'var(--line)' }} />
      <button className="menu-item" style={{ color: 'var(--bad)' }} onClick={() => { onDone(); onLogout() }}>
        <span className="flex items-center gap-2.5"><Icon name="logout" size={18} /> Log out</span>
      </button>
    </>
  )
}

// a bottom sheet for phones (spaces, account)
function Sheet({ title, onClose, children }) {
  const drag = useSheetDrag(onClose)
  useEffect(() => {
    const key = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])
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
  const [space, setSpace] = useState(() => {
    try { return localStorage.getItem('space') || 'personal' } catch { return 'personal' }
  })
  const uid = session?.user?.id
  const [username, setUsername] = useState('')
  const [view, setView] = useState('journal')            // journal | wishlist | activity
  const [adding, setAdding] = useState(false)             // + menu open
  const [addIntent, setAddIntent] = useState(null)        // { file? } -> Journal opens the place form
  const [sheet, setSheet] = useState(null)                // phones: 'spaces' | 'you'
  const [acctOpen, setAcctOpen] = useState(false)         // laptops: account dropdown
  const [stats, setStats] = useState({ places: 0, wish: 0, story: null })
  const acctRef = useRef(null)
  const desktop = useDesktop()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    // after an explicit logout, ignore late "signed in" events so the old session cannot come back
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (loggedOut.current && s) return; setSession(s) })
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadGroups = useCallback(async () => {
    if (!uid) return []
    const { data, error } = await supabase
      .from('group_members')
      .select('role, groups(id, name, invite_code, owner_id)')
      .eq('user_id', uid)
      .order('joined_at')
    if (error) { console.error(error); setGroupsReady(true); return [] }
    const list = (data || []).filter(r => r.groups).map(r => ({ ...r.groups, role: r.role }))
    setGroups(list)
    setGroupsReady(true)
    return list
  }, [uid])

  useEffect(() => { setGroupsReady(false); loadGroups() }, [loadGroups])

  useEffect(() => {
    if (!uid) { setUsername(''); return }
    // read my username; only on the very first login is the profile row missing — then create it
    // from the sign-up name and read again (saves a US round trip on every other app start)
    const read = () => supabase.from('profiles').select('username').eq('id', uid).maybeSingle()
    read()
      .then(r => (r.data ? r : supabase.rpc('ensure_profile').then(read)))
      .then(({ data }) => setUsername(data?.username || ''))
  }, [uid])

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
    if (groupsReady && space !== 'personal' && !groups.some(g => g.id === space)) chooseSpace('personal')
  }, [groupsReady, groups, space])

  // after create / join / leave / delete: refresh and jump to the new group if there is one
  async function groupsChanged(newId) {
    const list = await loadGroups()
    if (newId && list.some(g => g.id === newId)) chooseSpace(newId)
    else if (!list.some(g => g.id === space)) chooseSpace('personal')
  }

  if (session === undefined) return <div className="p-10"><div className="skel mx-auto max-w-md" /></div>
  if (!session) return <Login onSession={s => { loggedOut.current = false; setSession(s) }} />

  const activeGroup = groups.find(g => g.id === space) || null
  const pickAdd = intent => { setAdding(false); setView('journal'); setAddIntent(intent) }
  const go = v => { setView(v); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const account = { email: session.user.email, username, dark, setDark, onPassword: () => setPwOpen(true), onLogout: logout }

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
        {activeGroup && (
          <button className={`side-item ${view === 'activity' ? 'on' : ''}`} onClick={() => go('activity')}>
            <Icon name="activity" size={18} /> Activity
          </button>
        )}
        <div className="side-h">ASK BITEMARK</div>
        <button className="side-item" onClick={() => setAddIntent({ tool: 'craving' })}><Icon name="chat" size={18} /> Craving something?</button>
        <button className="side-item" onClick={() => setAddIntent({ tool: 'picker' })}><Icon name="dice" size={18} /> {activeGroup ? 'Where should we eat?' : 'Where to eat?'}</button>

        <div ref={acctRef} className="relative mt-auto pt-4">
          {acctOpen && (
            <div className="menu !bottom-[calc(100%+8px)] !left-0 !right-auto !top-auto">
              <AccountPanel {...account} onDone={() => setAcctOpen(false)} />
            </div>
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
            <button onClick={() => setDark(!dark)} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="ghost grid h-10 w-10 place-items-center rounded-full" style={{ color: 'var(--mute)' }}>
              <Icon name={dark ? 'sun' : 'moon'} size={20} />
            </button>
          </div>
        </header>

        <main className="main">
          <div className="wrap">
            {/* Personal doesn't need the groups list first: start loading it right away */}
            {groupsReady || space === 'personal'
              ? <Journal key={activeGroup?.id || 'personal'} me={uid} group={activeGroup} groups={groups} username={username}
                  view={view} setView={go} addIntent={addIntent} onIntentDone={() => setAddIntent(null)} onStats={setStats}
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
        <button className={`navbtn ${!sheet && (view === 'journal' || view === 'activity') ? 'on' : ''}`} onClick={() => go('journal')}><span className="navico"><Icon name="home" size={22} /></span>Home</button>
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
      {groupsOpen && <Groups me={uid} groups={groups} onClose={() => setGroupsOpen(false)}
        onChanged={groupsChanged} onOpen={chooseSpace} />}
    </div>
  )
}
