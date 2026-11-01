'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import ChangePassword from '@/components/auth/ChangePassword'
import Groups from '@/components/groups/Groups'
import Logo from '@/components/ui/Logo'
import Icon from '@/components/ui/Icons'
import AddMenu from '@/components/add/AddMenu'
import { tint } from '@/components/ui/shared'
import SharedPlaceSheet from '@/components/groups/SharedPlaceSheet'
import Toast from '@/components/app/Toast'
import StoryCard from '@/components/journal/StoryCard'
import Tour from '@/components/tour/Tour'
import FeatureGuide from '@/components/tour/FeatureGuide'
import DemoVideo from '@/components/tour/DemoVideo'
import { useSheetDrag, buzz } from '@/hooks/useGestures'
import { useEscape, useScrollLock } from '@/hooks/layers'
import { useInstall } from '@/hooks/install'
import { showInstall, inviteFriend } from '@/lib/install'
import { showAlert } from '@/lib/dialogs'
import InstallButton from '@/components/install/InstallButton'
import { useApp } from '@/components/app/AppProvider'
import { viewHref, spaceBase } from '@/lib/routes'

// The app shell (was App.jsx's markup): laptop sidebar, phone top bar and bottom bar, the + menu and
// the app-wide sheets and overlays. The open space's screen comes in as children.

// Account details + settings: a dropdown on laptops, a sheet from the "You" tab on phones.
// "Install app" (until it is installed: one tap where the browser allows, else the /install steps)
// and "Invite a friend" (shares the /install link: WhatsApp etc. on phones, copied on laptops)
function InstallItems({ onDone }) {
  const { mode, install } = useInstall()
  const [copied, setCopied] = useState(false)
  const invite = async () => {
    const url = window.location.origin + '/install'
    const done = await inviteFriend({ url, share: navigator.share ? d => navigator.share(d) : null,
      copy: navigator.clipboard?.writeText ? t => navigator.clipboard.writeText(t) : null })
    if (done === 'copied') { setCopied(true); setTimeout(() => setCopied(false), 1800) }
    if (done === 'show') showAlert({ tone: 'info', title: 'Invite a friend', message: `Send them this link to install BiteMark: ${url}` })
  }
  return (
    <>
      {showInstall(mode) && (
        <button className="menu-item" onClick={() => { if (mode === 'prompt') install(); else { onDone(); window.location.href = '/install' } }}>
          <span className="flex items-center gap-2.5"><Icon name="download" size={18} /> Install app</span>
        </button>
      )}
      <button className="menu-item" onClick={invite}>
        <span className="flex items-center gap-2.5"><Icon name={copied ? 'check' : 'send'} size={18} /> {copied ? 'Install link copied' : 'Invite a friend'}</span>
      </button>
    </>
  )
}

export function AccountPanel({ email, username, dark, setDark, onPassword, onLogout, onDone, onGuide, story, demo }) {
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
      <InstallItems onDone={onDone} />
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
export function Sheet({ title, onClose, children }) {
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

// the account panel's props, from the app state (the sidebar dropdown and the phone "You" sheet)
export function useAccount() {
  const { session, username, dark, setDark, setPwOpen, logout, setHelp, isDemo } = useApp()
  return { email: session?.user?.email, username, dark, setDark, onPassword: () => setPwOpen(true), onLogout: logout, onGuide: () => setHelp('guide'), demo: isDemo }
}

// laptops: "+ Add place" next to the Places header (the open space renders it)
export function AddButton() {
  const { adding, setAdding, desktop, pickAdd } = useApp()
  return (
    <div className="relative desktop-only">
      <button data-addbtn className="btn btn-accent" onClick={() => setAdding(!adding)} aria-expanded={adding}>
        <Icon name="plus" size={18} stroke={2.6} /> Add place
      </button>
      {adding && desktop && <AddMenu onPick={pickAdd} onClose={() => setAdding(false)} />}
    </div>
  )
}

const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

// The nav items are Links prefetched in full (so switching views and spaces needs no server, offline
// too) that behave like the old buttons: no drag, no long-press link menu (Android ignores the CSS callout).
export const navLink = { prefetch: true, scroll: false, draggable: false, onContextMenu: e => e.preventDefault() }

// Every space's views, prefetched in full while online (Links the user can't see: the phone's space
// sheet and the other spaces' views aren't on screen), so they all open offline later, as before.
function PrefetchSpaces({ groups }) {
  const spaces = [null, ...groups.map(g => g.id)]
  return (
    <div className="prefetch-links" aria-hidden="true">
      {spaces.flatMap(id => ['journal', 'wishlist', 'near', ...(id ? ['activity'] : [])].map(v => (
        <Link key={viewHref(v, id)} href={viewHref(v, id)} prefetch tabIndex={-1}>.</Link>
      )))}
    </div>
  )
}

export default function Shell({ children, modal }) {
  const app = useApp()
  const { session, me: uid, username, groups, dark, setDark, desktop, view, groupId, activeGroup, rememberSpace, startPending,
    adding, setAdding, pickAdd, openAdd, setHelp, help, tryIt, tourDone, stats, sheet, setSheet, acctOpen, setAcctOpen,
    pwOpen, setPwOpen, groupsOpen, groupsReady, closeSheet, groupsChanged, openGroups, openYou, share, setShare, shareToast, setShareToast,
    setShareRev, go, logout, isDemo } = app
  const acctRef = useRef(null)
  const account = useAccount()

  useEffect(() => {
    if (!acctOpen) return
    const close = e => { if (!acctRef.current?.contains(e.target)) setAcctOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [acctOpen])

  const spaceList = (onPicked = () => {}) => (
    <>
      <Link href="/" {...navLink} className={`side-item ${!activeGroup ? 'on' : ''}`} onClick={() => { rememberSpace('personal'); onPicked() }}>
        <Icon name="user" size={18} /> Personal
      </Link>
      {groups.map(g => (
        <Link key={g.id} href={spaceBase(g.id)} {...navLink} className={`side-item ${activeGroup?.id === g.id ? 'on' : ''}`} onClick={() => { rememberSpace(g.id); onPicked() }}>
          <span className="grid h-[18px] w-[18px] place-items-center rounded-md text-[10px] font-bold text-white" style={{ background: tint(g.id) }}>{g.name[0].toUpperCase()}</span>
          <span className="truncate">{g.name}</span>
        </Link>
      ))}
      <button className="side-item" style={{ color: 'var(--pri)' }} onClick={() => { onPicked(); openGroups() }}>
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
        <Link href={viewHref('journal', groupId)} {...navLink} onClick={toTop} className={`side-item ${view === 'journal' ? 'on' : ''}`}>
          <Icon name="home" size={18} /> Places <span className="count">{stats.places || ''}</span>
        </Link>
        <Link href={viewHref('wishlist', groupId)} {...navLink} onClick={toTop} className={`side-item ${view === 'wishlist' ? 'on' : ''}`}>
          <Icon name="bookmark" size={18} /> Want to try <span className="count">{stats.wish || ''}</span>
        </Link>
        <Link href={viewHref('near', groupId)} {...navLink} onClick={toTop} className={`side-item ${view === 'near' ? 'on' : ''}`}>
          <Icon name="locate" size={18} /> Near me
        </Link>
        {activeGroup && (
          <Link href={viewHref('activity', groupId)} {...navLink} onClick={toTop} className={`side-item ${view === 'activity' ? 'on' : ''}`}>
            <Icon name="activity" size={18} /> Activity
          </Link>
        )}
        <div className="side-h">ASK BITEMARK</div>
        <button className="side-item" onClick={() => openAdd({ tool: 'craving' })}><Icon name="chat" size={18} /> Craving something?</button>
        <button className="side-item" onClick={() => openAdd({ tool: 'picker' })}><Icon name="dice" size={18} /> {activeGroup ? 'Where should we eat?' : 'Where to eat?'}</button>
        <button className="side-item" onClick={() => setHelp('guide')}><Icon name="help" size={18} /> How BiteMark works</button>
        <InstallButton look="side" />

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
            <span className="flex shrink-0 items-center">
              <InstallButton look="pill" />
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
            {/* the open space (its layout loads Personal at once; a group waits for the groups list) */}
            {startPending
              ? <div className="space-y-3 pt-6"><div className="skel" /><div className="skel" /><div className="skel" /></div>
              : children}
          </div>
        </main>
      </div>

      {/* ---------- phone bottom bar ---------- */}
      <nav className="bottomnav" aria-label="Main" style={adding ? { zIndex: 42 } : null}>
        <Link href={viewHref('journal', groupId)} {...navLink} onClick={toTop} className={`navbtn ${!sheet && (view === 'journal' || view === 'activity' || view === 'near') ? 'on' : ''}`}><span className="navico"><Icon name="home" size={22} /></span>Home</Link>
        <Link href={viewHref('wishlist', groupId)} {...navLink} onClick={toTop} className={`navbtn ${!sheet && view === 'wishlist' ? 'on' : ''}`}><span className="navico"><Icon name="bookmark" size={22} /></span>Want to try</Link>
        <button data-addbtn className={`navplus ${adding ? 'open' : ''}`} onClick={() => { buzz(); setAdding(!adding) }} aria-label="Add" aria-expanded={adding}>
          <Icon name="plus" size={28} stroke={2.6} />
        </button>
        {/* inside a group this is the way home (the top-bar switcher was easy to miss);
            in Personal it opens your groups. A group's Activity lives on the group's own page. */}
        {activeGroup ? (
          <Link href="/" {...navLink} className="navbtn" onClick={() => { rememberSpace('personal'); window.scrollTo({ top: 0 }) }}>
            <span className="navico"><Icon name="user" size={22} /></span>Personal
          </Link>
        ) : (
          <button className={`navbtn ${sheet === 'spaces' ? 'on' : ''}`} onClick={() => setSheet('spaces')}><span className="navico"><Icon name="users" size={22} /></span>Groups</button>
        )}
        <button className={`navbtn ${sheet === 'you' ? 'on' : ''}`} onClick={openYou}>
          {/* your initial, like a profile photo — so it never looks like the "Personal" tab next to it */}
          <span className="navico"><span className="grid h-[22px] w-[22px] place-items-center rounded-full text-[11px] font-bold" style={{ background: 'var(--pri-soft)', color: 'var(--pri)', outline: '1.5px solid currentColor', outlineOffset: 1 }}>
            {(username || session.user.email || '?')[0].toUpperCase()}
          </span></span>You
        </button>
      </nav>
      {adding && !desktop && <AddMenu onPick={pickAdd} onClose={() => setAdding(false)} />}

      {sheet === 'spaces' && <Sheet title="Your spaces" onClose={() => setSheet(null)}>{spaceList(() => setSheet(null))}</Sheet>}
      {sheet === 'you' && <Sheet title="You" onClose={closeSheet}>
        <AccountPanel {...account} onDone={closeSheet} story={<StoryCard story={stats.story} space={activeGroup ? activeGroup.name : 'Personal'} />} />
      </Sheet>}

      {share && <SharedPlaceSheet data={share.data} candidates={share.candidates} loadError={share.loadError} onClose={() => setShare(null)}
        onSaved={name => { setShare(null); setShareRev(n => n + 1); setShareToast(`Exact spot saved for ${name}`) }}
        onAdd={(kind, prefill) => { setShare(null); go(kind === 'wish' ? 'wishlist' : 'journal', { replace: true }); openAdd(kind === 'wish' ? { wishPrefill: prefill } : { prefill }) }} />}
      {shareToast && <Toast key={shareToast} text={shareToast} />}
      {pwOpen && <ChangePassword onClose={() => setPwOpen(false)} />}
      {help === 'guide' && <FeatureGuide onClose={() => setHelp(null)} onTour={() => setHelp('tour')} onVideo={() => setHelp('video')} onTry={tryIt} />}
      {help === 'tour' && <Tour onDone={tourDone} />}
      {help === 'video' && <DemoVideo onClose={() => setHelp('guide')} />}
      {groupsOpen && groupsReady && <Groups me={uid} groups={groups} onClose={closeSheet}
        onChanged={groupsChanged} onOpen={app.chooseSpace} />}
      {/* routed overlays (app/(app)/@modal): the place sheet; the Groups and You sheets render above from the address */}
      {modal}
      <PrefetchSpaces groups={groups} />
    </div>
  )
}
