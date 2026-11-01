'use client'
import { filterPlaces, sortPlaces, activeFilterCount } from '@/lib/journalFilter'
import FilterSheet from '@/components/journal/FilterSheet'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import PlaceForm from '@/components/add/PlaceForm'
import ShareDish from '@/components/groups/ShareDish'
import DishForm from '@/components/journal/DishForm'
import Picker from '@/components/ask/Picker'
import CravingChat from '@/components/ask/CravingChat'
import PlaceDetail from '@/components/place/PlaceDetail'
import Icon from '@/components/ui/Icons'
import { priceScale } from '@/components/ui/shared'
import { smartIndex, shouldAutoWarm } from '@/lib/smartIndex'
import { docsFromPlaces } from '@/lib/smartSearch'
import { loadJournal, saveJournal } from '@/lib/fastStart'
import { foodStory } from '@/lib/foodStory'
import { mergeSpokenDishes } from '@/lib/placeRules'
import { usePullRefresh } from '@/hooks/useGestures'
import { showAlert } from '@/lib/dialogs'
import { optimistic } from '@/lib/optimistic'
import Toast from '@/components/app/Toast'
import FixLocations from '@/components/journal/FixLocations'
import { needsLocation } from '@/lib/locationValue'
import { autoLocate } from '@/lib/autoLocate'
import { useLocationReady } from '@/hooks/locationReady'
import { useApp } from '@/components/app/AppProvider'
import { AddButton, navLink } from '@/components/app/Shell'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { viewHref, placeHref } from '@/lib/routes'

// One space's journal (was Journal.jsx): loads places, wishlist and names once (with the fast-start
// snapshot), owns search / filters / sort, the place sheet, the forms and the overlays, and draws what
// every view of the space shares (header, group tabs, overlays). It sits in the space layouts
// (app/(app)/(personal)/layout.jsx and app/(app)/g/[groupId]/layout.jsx), so moving between Places,
// Want to try, Near me and Activity never reloads. The views (PlacesView, WishlistView, NearView,
// ActivityView) are the pages, and read it with useSpace().

const store = (() => { try { return window.localStorage } catch { return null } })()

const SAMPLE = [
  { name: 'Coffea: Brew on the Rocks', city: 'Vadodara', area: '13 Canal Rd', categories: ['Cafe'],
    dishes: [
      { name: 'Hazelnut cold coffee', price: 200, rating: 5, order_again: 'yes', note: 'Ekdum mast. Less sweet than Irish' },
      { name: 'Irish cold coffee', price: 200, rating: 3, order_again: 'maybe', note: 'Nice but too sweet' } ] },
  { name: 'Beyond 7', city: 'Vadodara', area: 'OP Road, after Atal Bridge', categories: ['Cafe'],
    dishes: [{ name: 'Hazelnut cold coffee', price: 230, rating: 4, order_again: 'maybe', note: 'Nice but pricey' }] },
  { name: 'BiteX', city: 'Ahmedabad', area: 'Memnagar', categories: ['Cafe'],
    directions: 'Memnagar Reliance Smart Bazar to Palladium, left at first circle',
    dishes: [{ name: 'Hazelnut cold coffee', price: 173, rating: 4, order_again: 'maybe', note: 'Enough for 2, too much for 1' }] },
]

// In a group, a dish's rating is the AVERAGE of everyone's ratings.
function groupDish(d) {
  const rs = d.dish_ratings || []
  const avg = rs.length ? rs.reduce((s, r) => s + r.rating, 0) / rs.length : 0
  const yes = rs.filter(r => r.order_again === 'yes').length
  const no = rs.filter(r => r.order_again === 'no').length
  return { ...d, avg, nRatings: rs.length, rating: avg, order_again: yes > no ? 'yes' : no > yes ? 'no' : null }
}

const SpaceContext = createContext(null)
export function useSpace() {
  const space = useContext(SpaceContext)
  if (!space) throw new Error('useSpace() must be used inside <SpaceProvider>')
  return space
}

// group = the open group (null = Personal). Keyed by the space in its layout, so a new space starts fresh.
export default function SpaceProvider({ group, children }) {
  // the view of the page in the children slot (stays put under an intercepted overlay), see AppProvider
  const { me, groups, username, addIntent, clearIntent, setStats, view, go, route } = useApp()
  // last time's journal for this person + space, shown at once while the fresh copy loads
  const spaceKey = group?.id || 'personal'
  const [snap] = useState(() => loadJournal(store, me, spaceKey))
  const [places, setPlaces] = useState(snap?.places || [])
  const [wishlist, setWishlist] = useState(snap?.wishlist || [])
  const [names, setNames] = useState(snap?.names || {})
  const [loading, setLoading] = useState(!snap)
  const [netErr, setNetErr] = useState('')          // the last refresh failed (offline etc.)
  const [editing, setEditing] = useState(null)     // place being edited
  const [wishPrefill, setWishPrefill] = useState(null)   // a shared place to add to Want to try
  const [creating, setCreating] = useState(null)   // {} or { prefill, wishId } or { billFile }
  const [sharing, setSharing] = useState(null)     // { place, dish } being added to a group
  const [addingDish, setAddingDish] = useState(null)
  const [picking, setPicking] = useState(false)
  const [asking, setAsking] = useState(false)
  const [notice, setNotice] = useState(null)       // { text, action?, onAction?, ms? } a short message
  const [fixing, setFixing] = useState(null)       // Add exact locations: the list to walk through

  // the place sheet lives in the address: /places/[id] (or /g/<gid>/places/[id]). A tap pushes it (soft
  // navigation, intercepted by @modal, so the view underneath stays mounted); closing goes Back when it was
  // opened in this session, else (direct link / refresh) replaces it with the space's Places view.
  const router = useRouter()
  const urlPlaceId = route.placeId
  const openedInApp = useRef(false)
  const closing = useRef(false)                      // a close is under way (stops a second Back, e.g. delete after edit)
  useEffect(() => { closing.current = false }, [urlPlaceId])
  const openPlace = id => {
    openedInApp.current = true; closing.current = false
    router.push(placeHref(id, group?.id), { scroll: false })
  }
  const closePlace = () => {
    if (!urlPlaceId || closing.current) return       // no sheet open
    closing.current = true
    if (openedInApp.current) router.back()
    else router.replace(viewHref('journal', group?.id), { scroll: false })
  }
  const openId = urlPlaceId

  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), notice.ms || 2600); return () => clearTimeout(t) }, [notice])

  // Delete a place: the form and details close and the card disappears at once; the server delete
  // runs behind. If it fails (no connection…) the place comes back and the reason is shown.
  function deletePlace(p) {
    setEditing(null); setCreating(null); closePlace()
    setNotice({ text: `Deleted “${p.name}”` })
    optimistic({
      apply: () => setPlaces(ps => ps.filter(x => x.id !== p.id)),
      run: () => supabase.from('places').delete().eq('id', p.id),
      undo: () => { setNotice(null); load() },
      fail: err => showAlert({ title: `Couldn’t delete “${p.name}”`, message: /fetch|network/i.test(err.message || '') ? 'No connection. It’s back in your journal; try again when you’re online.' : err.message }),
    }).then(ok => { if (ok) load() })                // fresh copy for the next app start
  }
  const [priceOpen, setPriceOpen] = useState(false)
  const [sheetTab, setSheetTab] = useState(null)   // phones: the filter sheet, opened on this section
  const [q, setQ] = useState('')
  const [city, setCity] = useState('All')
  const [cat, setCat] = useState('All')
  const [minRate, setMinRate] = useState(0)
  const [maxPrice, setMaxPrice] = useState(null)   // null = any price
  const [again, setAgain] = useState(false)
  const [sort, setSort] = useState(() => { try { return localStorage.getItem('sort') || 'recent' } catch { return 'recent' } })
  const chooseSort = v => { setSort(v); try { localStorage.setItem('sort', v) } catch {} }

  const isOwner = group?.role === 'owner'
  const canEditPlace = p => p.user_id === me || isOwner
  const canEditWish = w => w.user_id === me || isOwner          // same rule as removing one
  const mute = { color: 'var(--mute)' }

  async function load() {
    // bill_photos(id): just enough to show the 🧾 button; the images load when it is tapped
    const dishSel = group ? 'dishes(*, dish_ratings(*), dish_reactions(*), dish_comments(*))' : 'dishes(*)'
    const placesQ = bills => {
      const q = supabase.from('places').select(`*, ${bills ? 'bill_photos(id), ' : ''}${dishSel}`).order('created_at', { ascending: false })
      return group ? q.eq('group_id', group.id) : q.is('group_id', null)
    }
    let q2 = supabase.from('wishlist').select('*').is('went_at', null).order('created_at', { ascending: false })
    q2 = group ? q2.eq('group_id', group.id) : q2.is('group_id', null)

    // members' names load alongside, not after (each trip to the US database is ~0.25 s)
    const q3 = group ? supabase.from('profiles').select('id, display_name') : Promise.resolve({ data: null })
    let [r1, r2, r3] = await Promise.all([placesQ(true), q2, q3])
    // bills are an extra: if the API doesn't know bill_photos (migration not run, stale schema
    // cache), show the journal without 🧾 buttons rather than not at all
    if (r1.error && /bill_photos/.test(r1.error.message)) { console.warn(r1.error.message); r1 = await placesQ(false) }
    const fresh = {}
    // no connection / server trouble: keep what's on screen and say so calmly (never "your journal is empty")
    setNetErr(r1.error ? (/fetch|network|load failed/i.test(r1.error.message) ? 'No connection.' : r1.error.message) : '')
    if (r1.error) console.error(r1.error)
    else setPlaces(fresh.places = group
      ? r1.data.map(p => ({ ...p, dishes: [...(p.dishes || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map(groupDish) }))
      : r1.data)
    if (r2.error) console.error(r2.error)
    else setWishlist(fresh.wishlist = r2.data)
    if (r3.data) setNames(fresh.names = Object.fromEntries(r3.data.map(r => [r.id, r.display_name])))
    setLoading(false)
    // keep a snapshot so the next app start shows this at once (cleared on log out)
    if (fresh.places && fresh.wishlist) saveJournal(store, me, spaceKey, { places: fresh.places, wishlist: fresh.wishlist, names: fresh.names || {} })
  }
  useEffect(() => { load() }, [])

  // places without any position get an area-level one (from their landmark and city) in the
  // background; the journal reloads as they come in. Exact spots are never touched.
  const locReady = useLocationReady({ strict: true })
  useEffect(() => {
    const reload = () => load()
    // a place you just saved whose landmark OpenStreetMap doesn't know: say so, and offer the exact way
    const missed = e => {
      const { table, id, name } = e.detail || {}
      setNotice({ text: `Couldn’t place “${name || 'it'}” by its landmark`, ms: 7000,
        ...(table === 'places' ? { action: 'Fix', onAction: () => openPlace(id) } : {}) })
      load()
    }
    window.addEventListener('bm:located', reload)
    window.addEventListener('bm:notlocated', missed)
    return () => { window.removeEventListener('bm:located', reload); window.removeEventListener('bm:notlocated', missed) }
  }, [])
  useEffect(() => {
    if (loading || netErr || !locReady) return
    autoLocate(needsLocation(places, wishlist, canEditPlace, canEditWish).map(x => ({ table: x.table, id: x.id, area: x.area, city: x.city })))
  }, [places, wishlist, loading, netErr, locReady])

  async function seed() {
    for (const { dishes, ...place } of SAMPLE) {
      const { data, error } = await supabase.from('places').insert(place).select().single()
      if (error) return showAlert({ title: 'Couldn’t load the sample data', message: error.message })
      await supabase.from('dishes').insert(dishes.map(d => ({ ...d, place_id: data.id })))
    }
    load()
  }

  const scale = useMemo(() => priceScale(places), [places])
  const priceOn = maxPrice != null && maxPrice < scale.cap
  const opts = k => [...new Set(places.map(p => p[k]).filter(Boolean))]
  const dirty = q || city !== 'All' || cat !== 'All' || minRate || priceOn || again
  const reset = () => { setQ(''); setCity('All'); setCat('All'); setMinRate(0); setMaxPrice(null); setAgain(false) }

  const filters = { q, city, cat, minRate, maxPrice, again }
  const results = useMemo(() => filterPlaces(places, filters, scale.cap), [places, q, city, cat, minRate, maxPrice, again, scale.cap])
  const sorted = useMemo(() => sortPlaces(results, sort, q), [results, sort, q])

  // the + button / sidebar tools arrive from the shell as an "intent"
  useEffect(() => {
    if (!addIntent) return
    if (addIntent.tool === 'craving') setAsking(true)
    else if (addIntent.tool === 'picker') setPicking(true)
    else if (addIntent.tool === 'filters') { if (window.matchMedia?.('(max-width: 1023.98px)').matches) setSheetTab('cat') }
    else if (addIntent.prefill) setCreating({ prefill: addIntent.prefill })
    else if (addIntent.wishPrefill) setWishPrefill(addIntent.wishPrefill)
    else setCreating({ billFile: addIntent.file || null, voice: !!addIntent.voice })
    clearIntent()
  }, [addIntent])

  // ready = we really know what's in this journal (loaded, not failed): the first-visit tour waits for it
  useEffect(() => {
    setStats({ places: places.length, wish: wishlist.length, story: foodStory(places), ready: !loading && !netErr })
  }, [places, wishlist.length, loading, netErr])

  // phones: pull Home / Want to try down from the top to fetch the latest (the browser's own
  // pull-to-reload is turned off in index.css, and installed apps never had one)
  const pullBall = useRef(null)
  usePullRefresh(pullBall, load, view !== 'activity')

  // prepare the Craving chat's AI in the background once the journal is on screen, when the
  // browser is idle (so the page itself never stutters). Skipped on Data Saver / 2G: then the chat
  // starts it when opened. Only new or edited dishes are ever re-read (cached on the device).
  useEffect(() => {
    if (loading || !places.length || !shouldAutoWarm(navigator)) return
    const run = () => smartIndex.ensure(docsFromPlaces(places))
    const id = window.requestIdleCallback ? requestIdleCallback(run, { timeout: 4000 }) : setTimeout(run, 1500)
    return () => (window.cancelIdleCallback ? cancelIdleCallback(id) : clearTimeout(id))
  }, [loading, places])

  const dishTotal = places.reduce((n, p) => n + (p.dishes || []).length, 0)
  const open = openId && places.find(p => p.id === openId)
  const searching = q.trim().length > 0
  const priceLabel = priceOn ? `Under ₹${maxPrice}` : 'Price'
  const cities = opts('city')
  const nActive = activeFilterCount(filters, scale.cap)

  const value = {
    // the space and its data
    group, me, groups, view, places, wishlist, names, loading, netErr, reload: load, seed, dishTotal,
    isOwner, canEditPlace, canEditWish,
    // search, filters and sort
    q, setQ, city, setCity, cat, setCat, minRate, setMinRate, maxPrice, setMaxPrice, again, setAgain,
    sort, setSort: chooseSort, filters, reset, dirty, priceOn, priceLabel, priceOpen, setPriceOpen, sheetTab, setSheetTab,
    scale, results, sorted, cities, nActive, searching,
    // the place sheet
    openId, openPlace, closePlace,
    // forms and overlays
    setEditing, setCreating, setSharing, setAddingDish, setPicking, setAsking, setFixing, wishPrefill, setWishPrefill, deletePlace,
    notify: setNotice,
  }

  return (
    <SpaceContext.Provider value={value}>
    <div className="pb-6">
      <div ref={pullBall} className="ptr mobile-only" aria-hidden="true"><span className="ptr-ball"><Icon name="refresh" size={19} stroke={2.4} /></span></div>
      {/* ---------- header ---------- */}
      <div className="flex items-end justify-between gap-4 pb-4 pt-5 lg:pt-8">
        <div className="min-w-0">
          <h1 className="m-0 text-[24px] font-extrabold leading-tight lg:text-[30px]">
            {view === 'wishlist' ? 'Want to try' : view === 'near' ? 'Near me' : group ? group.name : username ? `Hi, ${username}` : 'Your places'}
          </h1>
          <p className="m-0 mt-1 text-sm" style={mute}>
            {view === 'wishlist' ? (group ? `Places ${group.name} wants to visit` : 'Places you want to visit')
              : view === 'near' ? (group ? `${group.name}’s places around you` : 'Your places around you')
              : view === 'activity' ? `What's new in ${group?.name}`
              : `${places.length} places · ${dishTotal} dishes · ${group ? `shared with ${group.name}` : 'only you can see this'}`}
          </p>
        </div>
        {view === 'journal' && <AddButton />}
      </div>

      {/* phones, inside a group: its places and its activity side by side (laptops: sidebar) */}
      {group && view !== 'wishlist' && view !== 'near' && (
        <div className="mobile-only mb-4 grid grid-cols-2 gap-1 rounded-xl p-1" role="tablist" aria-label={`${group.name} sections`} style={{ background: 'var(--soft)' }}>
          {[['journal', 'Places', 'home'], ['activity', 'Activity', 'activity']].map(([k, l, ic]) => (
            // Links (prefetched in full) so the group's views switch without the server, offline too
            <Link key={k} href={viewHref(k, group.id)} {...navLink} role="tab" aria-selected={view === k}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              onKeyDown={e => { if (e.key === ' ') { e.preventDefault(); go(k) } }}   // Space, like the old tab button
              className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition"
              style={view === k ? { background: 'var(--surface)', color: 'var(--pri)', boxShadow: 'var(--sh-1)' } : { color: 'var(--mute)' }}>
              <Icon name={ic} size={16} />{l}
            </Link>
          ))}
        </div>
      )}

      {/* a soft change when switching tabs; the view itself is the page (app/(app)/…/page.jsx) */}
      <div key={view} className="tabin">
      {children}
      </div>

      {open && (
        <PlaceDetail p={{ ...open, allDishes: open.dishes }} me={me} group={group} names={names} isOwner={isOwner}
          canEdit={canEditPlace(open)} onClose={closePlace} onChanged={load}
          onEdit={() => { closePlace(); setEditing({ ...open }) }}
          onAddDish={() => setAddingDish({ id: open.id, name: open.name, dishes: open.dishes })}
          onShare={d => setSharing({ place: open, dish: d })}
          onLocate={() => setFixing([{ ...open, table: 'places' }])} />
      )}

      {sheetTab && (
        <FilterSheet places={places} filters={filters} sort={sort} scale={scale} cities={cities} start={sheetTab}
          onClose={() => setSheetTab(null)}
          onApply={(d, s) => {
            setCity(d.city); setCat(d.cat); setMinRate(d.minRate); setMaxPrice(d.maxPrice); setAgain(d.again); chooseSort(s)
            setSheetTab(null)
          }} />
      )}

      {sharing && (
        <ShareDish me={me} place={sharing.place} dish={sharing.dish} groups={groups} onClose={() => setSharing(null)} />
      )}

      {addingDish && (
        <DishForm me={me} place={addingDish} onClose={() => setAddingDish(null)}
          onSaved={() => { setAddingDish(null); load() }} />
      )}

      {picking && <Picker places={places} wishlist={wishlist} group={group} onClose={() => setPicking(false)} />}

      {notice && <Toast key={notice.text} text={notice.text} action={notice.action} onAction={() => { setNotice(null); notice.onAction?.() }} />}

      {fixing && (
        <FixLocations places={fixing} onClose={() => setFixing(null)} onSaved={() => { setFixing(null); load() }} />
      )}

      {asking && <CravingChat places={places} onClose={() => setAsking(false)} onOpenPlace={id => { setAsking(false); openPlace(id) }} />}

      {(editing || creating) && (
        <PlaceForm key={editing?.id || 'new'} me={me} place={editing} prefill={creating?.prefill} wishId={creating?.wishId} initialBill={creating?.billFile}
          initialVoice={!!creating?.voice} knownPlaces={group ? [] : places}
          onUseExisting={(p, said) => {
            // voice named a place you already have: open THAT place with the new dishes added
            const rows = (p.dishes || []).map(d => ({ name: d.name, price: d.price ?? '', rating: d.rating || 0, order_again: d.order_again || '', note: d.note || '' }))
            setCreating(null)
            setEditing({ ...p, dishes: mergeSpokenDishes(rows, said) })
          }}
          cities={opts('city')} groups={groups} defaultGroupId={group?.id || ''}
          onClose={() => { setEditing(null); setCreating(null) }}
          onSaved={() => { setEditing(null); setCreating(null); load() }}
          onDelete={deletePlace} />
      )}
    </div>
    </SpaceContext.Provider>
  )
}
