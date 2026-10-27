import { filterPlaces, sortPlaces, activeFilterCount, SORTS } from './journalFilter'
import FilterSheet from './FilterSheet'
import ChipSelect from './ChipSelect'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase'
import PlaceForm from './PlaceForm'
import ShareDish from './ShareDish'
import DishForm from './DishForm'
import Wishlist from './Wishlist'
import Activity from './Activity'
import Picker from './Picker'
import CravingChat from './CravingChat'
import PlaceCard from './PlaceCard'
import PlaceDetail from './PlaceDetail'
import Icon from './Icons'
import { CATEGORIES, priceScale, PriceSlider } from './shared'
import { smartIndex, shouldAutoWarm } from './smartIndex'
import { docsFromPlaces } from './smartSearch'
import { loadJournal, saveJournal } from './fastStart'
import { foodStory } from './foodStory'
import { mergeSpokenDishes } from './placeRules'
import { usePullRefresh } from './useGestures'

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

// me = my user id, group = the open group (null = Personal), groups = all my groups.
// view / setView and the + button's addIntent come from the app shell (sidebar / bottom bar).
export default function Journal({ me, group, groups, username, view, setView, addIntent, onIntentDone, onStats, addButton, onHelp = () => {} }) {
  // last time's journal for this person + space, shown at once while the fresh copy loads
  const spaceKey = group?.id || 'personal'
  const [snap] = useState(() => loadJournal(store, me, spaceKey))
  const [places, setPlaces] = useState(snap?.places || [])
  const [wishlist, setWishlist] = useState(snap?.wishlist || [])
  const [names, setNames] = useState(snap?.names || {})
  const [loading, setLoading] = useState(!snap)
  const [netErr, setNetErr] = useState('')          // the last refresh failed (offline etc.)
  const [editing, setEditing] = useState(null)     // place being edited
  const [creating, setCreating] = useState(null)   // {} or { prefill, wishId } or { billFile }
  const [sharing, setSharing] = useState(null)     // { place, dish } being added to a group
  const [addingDish, setAddingDish] = useState(null)
  const [picking, setPicking] = useState(false)
  const [asking, setAsking] = useState(false)
  const [openId, setOpenId] = useState(null)       // place whose details are open
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

  async function seed() {
    for (const { dishes, ...place } of SAMPLE) {
      const { data, error } = await supabase.from('places').insert(place).select().single()
      if (error) return alert(error.message)
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
    else setCreating({ billFile: addIntent.file || null, voice: !!addIntent.voice })
    onIntentDone()
  }, [addIntent])

  // ready = we really know what's in this journal (loaded, not failed): the first-visit tour waits for it
  useEffect(() => {
    onStats({ places: places.length, wish: wishlist.length, story: foodStory(places), ready: !loading && !netErr })
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
  const toggle = (on, set) => set(!on)
  const cities = opts('city')
  const nActive = activeFilterCount(filters, scale.cap)

  return (
    <div className="pb-6">
      <div ref={pullBall} className="ptr mobile-only" aria-hidden="true"><span className="ptr-ball"><Icon name="refresh" size={19} stroke={2.4} /></span></div>
      {/* ---------- header ---------- */}
      <div className="flex items-end justify-between gap-4 pb-4 pt-5 lg:pt-8">
        <div className="min-w-0">
          <h1 className="m-0 text-[24px] font-extrabold leading-tight lg:text-[30px]">
            {view === 'wishlist' ? 'Want to try' : group ? group.name : username ? `Hi, ${username}` : 'Your places'}
          </h1>
          <p className="m-0 mt-1 text-sm" style={mute}>
            {view === 'wishlist' ? (group ? `Places ${group.name} wants to visit` : 'Places you want to visit')
              : view === 'activity' ? `What's new in ${group?.name}`
              : `${places.length} places · ${dishTotal} dishes · ${group ? `shared with ${group.name}` : 'only you can see this'}`}
          </p>
        </div>
        {view === 'journal' && addButton}
      </div>

      {/* phones, inside a group: its places and its activity side by side (laptops: sidebar) */}
      {group && view !== 'wishlist' && (
        <div className="mobile-only mb-4 grid grid-cols-2 gap-1 rounded-xl p-1" role="tablist" aria-label={`${group.name} sections`} style={{ background: 'var(--soft)' }}>
          {[['journal', 'Places', 'home'], ['activity', 'Activity', 'activity']].map(([k, l, ic]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
              className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition"
              style={view === k ? { background: 'var(--surface)', color: 'var(--pri)', boxShadow: 'var(--sh-1)' } : { color: 'var(--mute)' }}>
              <Icon name={ic} size={16} />{l}
            </button>
          ))}
        </div>
      )}

      {/* a soft change when switching tabs */}
      <div key={view} className="tabin">
      {view === 'wishlist' && (
        <Wishlist me={me} group={group} items={wishlist} names={names} isOwner={isOwner} onChanged={load}
          onWent={w => setCreating({ prefill: { name: w.name, city: w.city, area: w.area, categories: w.categories || [] }, wishId: w.id })} />
      )}

      {view === 'activity' && group && <Activity me={me} group={group} names={names} />}

      {view === 'journal' && (
        <>
          {/* quick tools: in the sidebar on laptops */}
          <div className="mobile-only mb-4 grid grid-cols-2 gap-2.5">
            <button className="quick" onClick={() => setAsking(true)}>
              <span className="qicon" style={{ background: 'var(--pri-soft)', color: 'var(--pri)' }}><Icon name="chat" /></span>
              <span className="min-w-0 text-[13px] leading-tight"><b className="block text-[14px]">Craving?</b><span style={mute}>Ask your journal</span></span>
            </button>
            <button className="quick" onClick={() => setPicking(true)}>
              <span className="qicon" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}><Icon name="dice" /></span>
              <span className="min-w-0 text-[13px] leading-tight"><b className="block text-[14px]">Where to eat?</b><span style={mute}>Pick for me</span></span>
            </button>
          </div>

          {/* ---------- search + filters ---------- */}
          <div className="sticky top-[61px] z-10 -mx-4 bg-[var(--bg)] px-4 pb-3 pt-1 lg:static lg:mx-0 lg:px-0">
            <label className="searchbar">
              <Icon name="search" size={19} style={mute} />
              <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search a dish, place, area or note…" aria-label="Search" />
              {q && <button onClick={() => setQ('')} aria-label="Clear search" className="ghost grid h-7 w-7 place-items-center rounded-full" style={mute}><Icon name="x" size={15} /></button>}
            </label>

            {/* phones: one tidy row + a filter sheet (Zomato / Swiggy pattern) */}
            <div className="mobile-only mt-3 flex items-center gap-2">
              <button className={`chip ${nActive ? 'on' : ''}`} onClick={() => setSheetTab('cat')} aria-label={`Filters${nActive ? `, ${nActive} on` : ''}`}>
                <Icon name="sliders" size={15} /> Filters
                {nActive > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold" style={{ background: 'var(--pri)', color: 'var(--on-pri)' }}>{nActive}</span>}
              </button>
              <button className={`chip ${sort !== 'recent' ? 'on' : ''}`} onClick={() => setSheetTab('sort')}>
                {SORTS.find(([v]) => v === sort)?.[1]} <Icon name="down" size={14} />
              </button>
              <button className={`chip ${again ? 'on' : ''}`} aria-pressed={again} onClick={() => setAgain(!again)}>
                {again && <Icon name="check" size={14} stroke={2.8} />} Order again
              </button>
            </div>
            {nActive > 0 && (
              <div className="mobile-only mt-2.5 flex flex-wrap gap-1.5">
                {[
                  city !== 'All' && [city, () => setCity('All')],
                  cat !== 'All' && [cat, () => setCat('All')],
                  priceOn && [`Under ₹${maxPrice}`, () => setMaxPrice(null)],
                  minRate > 0 && [minRate === 5 ? '5★ dishes' : `${minRate}★ & up`, () => setMinRate(0)],
                  again && ['Order again', () => setAgain(false)],
                ].filter(Boolean).map(([label, off]) => (
                  <button key={label} onClick={off} className="fade inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{ background: 'var(--pri-soft)', color: 'var(--pri)' }} aria-label={`Remove filter ${label}`}>
                    {label} <Icon name="x" size={12} stroke={2.6} />
                  </button>
                ))}
                <button onClick={() => { reset(); setPriceOpen(false) }} className="px-1.5 py-1 text-xs font-semibold" style={mute}>Clear all</button>
              </div>
            )}

            {/* laptops: everything visible as chips */}
            <div className="desktop-only mt-3 flex flex-wrap gap-2">
              <ChipSelect icon="sliders" label="Sort places" value={sort} options={SORTS} onChange={chooseSort} active={sort !== 'recent'} />
              {cities.length > 1 && (
                <ChipSelect icon="pin" label="City" value={city} onChange={setCity} active={city !== 'All'}
                  options={[['All', 'All cities'], ...cities.map(c => [c, c])]} />
              )}
              {CATEGORIES.map(c => (
                <button key={c} className={`chip ${cat === c ? 'on' : ''}`} aria-pressed={cat === c} onClick={() => setCat(cat === c ? 'All' : c)}>{c}</button>
              ))}
              <button className={`chip ${minRate === 4 ? 'on' : ''}`} aria-pressed={minRate === 4} onClick={() => setMinRate(minRate === 4 ? 0 : 4)}>4★ & up</button>
              <button className={`chip ${again ? 'on' : ''}`} aria-pressed={again} onClick={() => toggle(again, setAgain)}>Order again</button>
              <button className={`chip ${priceOn || priceOpen ? 'on' : ''}`} aria-expanded={priceOpen} onClick={() => setPriceOpen(!priceOpen)}>
                {priceLabel} <Icon name="down" size={14} style={{ transform: priceOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
              {dirty && <button className="chip fade" onClick={() => { reset(); setPriceOpen(false) }}><Icon name="x" size={14} /> Clear</button>}
            </div>

            {priceOpen && (
              <div className="desktop-only sheet mt-3 max-w-xl rounded-2xl border px-4 pb-2 pt-3" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">Max price per dish</span>
                  <span className="font-bold" style={{ color: 'var(--pri)' }}>{priceOn ? '₹' + maxPrice : 'Any'}</span>
                </div>
                <PriceSlider places={places} scale={scale} maxPrice={maxPrice} onChange={setMaxPrice} />
              </div>
            )}
          </div>

          {!loading && places.length > 0 && (
            <p className="mb-3 mt-1 text-[13px] font-semibold" style={mute}>
              {sorted.length === places.length ? `${places.length} places` : `${sorted.length} of ${places.length} places`}
            </p>
          )}

          {netErr && (
            <div className="fade mb-3 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm" role="status" style={{ background: 'var(--errbg)', color: 'var(--bad)' }}>
              <span className="flex-1">{netErr} {places.length ? 'Showing your journal from this device.' : "Couldn't load your journal."}</span>
              <button className="font-semibold underline" onClick={load}>Try again</button>
            </div>
          )}

          {loading ? (
            <div className="place-grid">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="skel !h-[104px]" />)}</div>
          ) : places.length === 0 && netErr ? null : places.length === 0 ? (
            <div className="rise py-16 text-center">
              <span className="qicon mx-auto mb-4 !h-16 !w-16" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}><Icon name="receipt" size={30} /></span>
              <p className="m-0 text-lg font-bold">{group ? `${group.name} has no places yet` : 'Your journal is empty'}</p>
              <p className="mx-auto mb-5 mt-1 max-w-xs text-sm" style={mute}>Tap + to scan a bill, say it, or add your first place by hand.</p>
              <div className="mb-4 flex flex-wrap justify-center gap-2">
                <button className="btn btn-pri !py-2 !text-sm" onClick={() => onHelp('tour')}><Icon name="play" size={16} /> Play the 1-minute tour</button>
                <button className="btn !py-2 !text-sm" onClick={() => onHelp('guide')}><Icon name="help" size={16} /> See all features</button>
              </div>
              {!group && <button onClick={seed} className="tbtn text-sm font-semibold" style={{ color: 'var(--pri)' }}>or load sample data</button>}
            </div>
          ) : sorted.length === 0 ? (
            <div className="fade py-16 text-center" style={mute}>
              <p className="m-0 font-semibold" style={{ color: 'var(--ink)' }}>Nothing matches</p>
              <p className="m-0 mt-1 text-sm">Try fewer filters or a different word.</p>
              <button className="btn mt-4 !py-2 !text-sm" onClick={() => { reset(); setPriceOpen(false) }}>Clear filters</button>
            </div>
          ) : (
            <div className="place-grid">
              {sorted.map((p, i) => (
                <PlaceCard key={p.id} p={p} index={i} group={group} me={me} names={names}
                  searching={searching || minRate > 0 || again || priceOn} onOpen={() => setOpenId(p.id)} />
              ))}
            </div>
          )}
        </>
      )}
      </div>

      {open && (
        <PlaceDetail p={{ ...open, allDishes: open.dishes }} me={me} group={group} names={names} isOwner={isOwner}
          canEdit={canEditPlace(open)} onClose={() => setOpenId(null)} onChanged={load}
          onEdit={() => { setOpenId(null); setEditing({ ...open }) }}
          onAddDish={() => setAddingDish({ id: open.id, name: open.name, dishes: open.dishes })}
          onShare={d => setSharing({ place: open, dish: d })} />
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

      {asking && <CravingChat places={places} onClose={() => setAsking(false)} onOpenPlace={id => { setAsking(false); setOpenId(id) }} />}

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
          onSaved={() => { setEditing(null); setCreating(null); load() }} />
      )}
    </div>
  )
}
