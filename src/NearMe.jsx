import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icons'
import LeafletMap from './LeafletMap'
import ChipSelect from './ChipSelect'
import AreaCard from './AreaCard'
import { areaSummary, heatPoints, foodHome, addedByOptions, adderInitial } from './mapInsights'
import { tileColor } from './PlaceCard'
import { CATEGORIES } from './shared'
import { placeSummary, placeWhere } from './placeView'
import { filterPlaces, NO_FILTERS } from './journalFilter'
import { getPosition } from './locate'
import { sortByDistance, homeCity, isLocated, isExact, distanceLabel, directionsUrl, bestRating, pinColor, RADII, withinKm, widerRadius, radiusLabel, inBounds } from './geo'
import { showFixHint } from './locationSupport'
import { useLocationReady } from './locationReady'
import { supabase } from './supabase'
import { getRoute, tripLabel, walkMinutes } from './route'
import { getTrip, googleDirectionsUrl, CRAWL_MAX } from './crawl'
import CrawlBar from './CrawlBar'
import FoodReplay from './FoodReplay'
import { replayFrames, replaySummary } from './replayPlan'
import { useEscape, useScrollLock } from './layers'
import { nearbyGuess, nudgeDismissed, dismissNudge, nudgeKey } from './hereNudge'

const HINT = 'bm.fixhint'                // how many were waiting when the quiet line was hidden
const ALL = 'All'
const INDIA = { lat: 20.59, lng: 78.96 }

const HELP = {
  denied: 'Location is off for BiteMark, so there are no distances. Allow it in your browser’s site settings to sort by what’s nearest.',
  unavailable: 'Couldn’t find where you are, so there are no distances.',
  timeout: 'Finding you took too long, so there are no distances.',
  unsupported: 'This browser can’t share your location, so there are no distances.',
}

// "Near me": the open space's places (and its Want to try list) on a list and a map, nearest first.
// Two ways to narrow it: a city (all its places, e.g. Vadodara while you're in Ahmedabad), or a
// distance around you (1 / 3 / 5 / 10 km, across cities). Choosing one clears the other.
// It starts on the city you're in. Without your location it still works, just without distances.
// Your own position stays on this screen: it's never saved or sent anywhere.
export default function NearMe({ places, wishlist, names = {}, uid, group = null, toFix = 0, onOpenPlace, onFix, canEdit = () => false, onSaved }) {
  const [me, setMe] = useState(null)
  const [err, setErr] = useState('')
  const [locating, setLocating] = useState(true)
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('near.mode') || 'list' } catch { return 'list' } })
  const [city, setCity] = useState(null)           // null until it settles on the city you're in
  const [radius, setRadius] = useState(() => { try { return +localStorage.getItem('near.radius') || null } catch { return null } })
  const [cat, setCat] = useState(ALL)
  const [by, setBy] = useState('')                  // group space: only what this person added ('' = everyone)
  const [again, setAgain] = useState(false)
  const [wishes, setWishes] = useState(true)
  const [sel, setSel] = useState(null)
  const [area, setArea] = useState(null)           // a tapped bubble: { ids, zoomIn }
  const [only, setOnly] = useState(null)           // "Show these": { ids, name } narrows the list and map
  const [view, setView] = useState(null)          // what the map shows: { south, west, north, east }
  const [hover, setHover] = useState(null)         // desktop: the list card under the mouse lights its pin
  const [heatOn, setHeatOn] = useState(false)      // Map view: a glow over where you eat
  const [picking, setPicking] = useState(false)  // "Plan a route": taps pick stops instead of selecting
  const [picks, setPicks] = useState([])           // picked keys, in the order tapped
  const [crawl, setCrawl] = useState(null)         // null | { busy } | { failed } | { trip } (trip.order = best order)
  const [pickNote, setPickNote] = useState('')
  const [full, setFull] = useState(false)          // the map fills the screen
  const [rp, setRp] = useState(null)               // replay your food year: null | { i, playing, end }
  const planned = useRef(0)                        // a newer Plan / Clear makes an older answer stale
  const popRef = useRef(null)
  const railRef = useRef(null)
  const fromRail = useRef(null)                    // the key the rail itself just selected (so we don't scroll it again)
  const touched = useRef(false)                    // only a real swipe on the rail may select, not its first paint
  const ready = useLocationReady()
  const [hiddenAt, setHiddenAt] = useState(() => { try { const v = localStorage.getItem(HINT); return v == null ? null : +v } catch { return null } })
  const [no, setNo] = useState(() => nudgeDismissed(localStorage))
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const hideHint = () => { setHiddenAt(toFix); try { localStorage.setItem(HINT, String(toFix)) } catch {} }
  // a tapped bubble's card opens above the cards; bring it into view
  useEffect(() => { if (area) popRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [area])
  const setBox = b => setView(o => (o && b && o.south === b.south && o.west === b.west && o.north === b.north && o.east === b.east ? o : b))

  async function locate() {
    setLocating(true); setErr('')
    try { const p = await getPosition(); setMe({ lat: p.lat, lng: p.lng, acc: p.acc }) }
    catch (e) { setErr(e.code || 'unavailable') }
    setLocating(false)
  }
  useEffect(() => { locate() }, [])
  const endCrawl = () => { planned.current++; setPicks([]); setCrawl(null); setPickNote('') }
  const togglePick = () => { setFull(false); endCrawl(); setSel(null); setArea(null); setPicking(p => !p) }
  const chooseMode = m => { setRp(null); setPicking(false); endCrawl(); setMode(m); setSel(null); setArea(null); setView(null); setHover(null); try { localStorage.setItem('near.mode', m) } catch {} }
  const chooseRadius = km => {
    setRadius(km); setSel(null); setArea(null); setOnly(null)
    if (km) setCity(ALL)                           // a distance is around you, whatever the city
    try { localStorage.setItem('near.radius', km ? String(km) : '') } catch {}
  }
  const chooseCity = c => { setCity(c); setSel(null); setArea(null); setOnly(null); if (radius) chooseRadius(null) }

  const byOk = x => !group || !by || x.user_id === by
  const adders = useMemo(() => (group ? addedByOptions([...places, ...wishlist], names, uid) : []), [group, places, wishlist, names, uid])
  // the person you filtered to is gone (e.g. their last place was deleted): back to everyone, so the filter can't get stuck with no chip
  useEffect(() => { if (by && !adders.some(o => o[0] === by)) setBy('') }, [by, adders])
  const items = useMemo(() => [
    ...filterPlaces(places.filter(byOk), { ...NO_FILTERS, cat, again }).map(p => ({ ...p, kind: 'place', key: 'p' + p.id })),
    ...(wishes && !again ? wishlist.filter(w => byOk(w) && (cat === ALL || (w.categories || []).includes(cat))).map(w => ({ ...w, kind: 'wish', key: 'w' + w.id })) : []),
  ], [places, wishlist, cat, again, wishes, by, group])
  // standing at a place that only has an area-level position? offer your spot as its exact one
  const guess = useMemo(() => nearbyGuess(
    [...places.map(p => ({ ...p, kind: 'place' })), ...wishlist.map(w => ({ ...w, kind: 'wish' }))].filter(canEdit), me, no), [places, wishlist, me, no])
  const notNow = () => { dismissNudge(localStorage, nudgeKey(guess)); setNo(nudgeDismissed(localStorage)); setSaveErr('') }
  async function saveHere() {
    setSaving(true); setSaveErr('')
    const { data, error } = await supabase.from(guess.kind === 'place' ? 'places' : 'wishlist')
      .update({ lat: me.lat, lng: me.lng, loc_source: 'gps' }).eq('id', guess.id).select('id')
    setSaving(false)
    if (error || !data?.length) { setSaveErr('Couldn’t save the spot. Try again in a moment.'); return }
    onSaved?.()
  }
  const located = useMemo(() => [...places, ...wishlist].filter(isLocated), [places, wishlist])
  const cities = useMemo(() => [...new Set(located.map(p => (p.city || '').trim()).filter(Boolean))].sort(), [located])

  // start on the city you're in (once your position is known, or known to be unavailable)
  useEffect(() => {
    if (city !== null || locating) return
    const here = homeCity(located, me)
    setCity(here && cities.length > 1 && !radius ? here : ALL)
  }, [locating, me, located, cities.length])
  const sorted = useMemo(() => sortByDistance(city && city !== ALL ? items.filter(x => (x.city || '').trim() === city) : items, me), [items, city, me])
  const near = me ? radius : null                   // a distance only means something once we know where you are
  const within = useMemo(() => withinKm(sorted, near), [sorted, near])
  const shown = useMemo(() => (only ? within.filter(x => only.ids.includes(x.key)) : within), [within, only])
  const wider = near && !shown.length ? widerRadius(sorted, near) : null
  const missing = toFix
  const anyLocated = located.length > 0
  const picked = shown.find(x => x.key === sel)
  // road time and route for the tapped pin: one request per tap (cached), nothing shown if it fails
  const [trip, setTrip] = useState(null)         // { key, route }
  const pickedAt = picked && me ? `${picked.lat},${picked.lng}` : null
  const meAt = me ? `${me.lat.toFixed(3)},${me.lng.toFixed(3)}` : null
  useEffect(() => {
    setTrip(null)
    if (!pickedAt || mode !== 'map' || picking) return
    let stale = false
    getRoute(me, picked).then(route => { if (!stale && route) setTrip({ key: sel, route }) })
    return () => { stale = true }
  }, [sel, pickedAt, meAt, mode, picking])
  const tripNow = trip && trip.key === sel ? trip.route : null
  // food crawl: the picked places that are still shown, tapped order (or the best order once planned)
  const stops = useMemo(() => picks.map(k => shown.find(x => x.key === k)).filter(Boolean), [picks, shown])
  const ordered = crawl?.trip ? crawl.trip.order : stops
  const numOf = useMemo(() => new Map(ordered.map((x, i) => [x.key, i + 1])), [ordered])
  function pick(key) {
    setPickNote('')
    if (crawl) { planned.current++; setCrawl(null) }     // a changed pick list needs a new plan
    if (picks.includes(key)) { setPicks(picks.filter(k => k !== key)); return }
    if (picks.length >= CRAWL_MAX) { setPickNote(`That’s the most for one route (${CRAWL_MAX}). Remove one to add another.`); return }
    setPicks([...picks, key])
  }
  const stopKeys = stops.map(x => x.key).sort().join('|')
  async function plan() {
    const id = ++planned.current
    const keys = stopKeys
    setCrawl({ busy: true, keys }); setPickNote('')
    const t = await getTrip(me, stops)
    if (id === planned.current) setCrawl(t ? { trip: t, keys } : { failed: true, keys })
  }
  // a filter that hides (or shows) a picked stop makes the plan stale: drop it, keep the picks
  useEffect(() => { if (crawl && crawl.keys !== stopKeys) { planned.current++; setCrawl(null) } }, [stopKeys, crawl])
  const areaItems = area ? shown.filter(x => area.ids.includes(x.key)) : []
  const summary = useMemo(() => (area ? areaSummary(areaItems) : null), [area, shown])
  const mute = { color: 'var(--mute)' }
  // the cards follow the map: only the places in view, nearest first (shown is already in that order)
  const inView = useMemo(() => inBounds(shown, view), [shown, view])
  // the chosen place keeps its card (with Close and the trip) even if you pan it out of view
  const offView = picked && !inView.includes(picked) ? picked : null
  const railItems = offView ? [offView, ...inView] : inView
  const railKeys = railItems.map(x => x.key).join('|')
  const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const wide = () => window.matchMedia?.('(min-width:1024px)').matches

  // a pin tap brings its card into view (the rail on phones, the side list on desktop); a swipe doesn't re-scroll
  useEffect(() => {
    if (mode !== 'map' || !sel) return
    if (fromRail.current === sel) { fromRail.current = null; return }
    const card = railRef.current?.querySelector(`[data-key="${sel}"]`)
    if (!card) return
    touched.current = false
    card.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduce() ? 'auto' : 'smooth' })
  }, [sel, mode])

  // phones: the card centred in the rail becomes the selected pin (after a short pause, so a fast swipe is one request)
  useEffect(() => {
    const rail = railRef.current
    if (mode !== 'map' || picking || rp || !rail || wide() || typeof IntersectionObserver === 'undefined') return
    let timer
    let first = true                               // a new observer reports every card once on its own: that isn't a swipe
    touched.current = false
    const mark = () => { touched.current = true }
    const evs = ['touchstart', 'pointerdown', 'wheel', 'keydown']
    evs.forEach(e => rail.addEventListener(e, mark, { passive: true }))
    const io = new IntersectionObserver(entries => {
      if (first) { first = false; return }
      const hit = entries.find(e => e.isIntersecting && e.intersectionRatio >= 0.6)
      if (!hit || !touched.current) return
      const key = hit.target.dataset.key
      clearTimeout(timer)
      timer = setTimeout(() => { fromRail.current = key; setArea(null); setSel(k => { if (k === key) fromRail.current = null; return key }) }, 400)
    }, { root: rail, threshold: 0.6 })
    rail.querySelectorAll('[data-key]').forEach(c => io.observe(c))
    return () => { clearTimeout(timer); io.disconnect(); evs.forEach(e => rail.removeEventListener(e, mark)) }
  }, [mode, railKeys, picking, !!rp])

  const ring = useMemo(() => (near && !rp ? { ...me, km: near } : null), [me, near, rp])

  // replay your food year: every located journal place by month; the map shows the pins so far but keeps the full-set frame
  const frames = useMemo(() => replayFrames(places), [places])
  // places can reload mid-replay (background location filling): never index past the frames, and stop if fewer than 2 remain
  const frame = rp && frames.length >= 2 ? frames[Math.min(rp.i, frames.length - 1)] : null
  useEffect(() => { if (rp && frames.length < 2) setRp(null) }, [rp, frames.length])
  const replayAll = useMemo(() => (frame ? frames[frames.length - 1].ids : []), [!!frame, frames])
  const replayPins = useMemo(() => {
    if (!frame) return null
    const pin = x => ({ id: 'p' + x.id, kind: 'place', lat: x.lat, lng: x.lng, title: x.name, approx: !isExact(x), color: pinColor(bestRating(x)) })
    const byId = new Map(places.filter(isLocated).map(x => [String(x.id), x]))
    return { all: replayAll.map(id => pin(byId.get(id))), now: frame.ids.map(id => pin(byId.get(id))) }
  }, [!!frame, replayAll, frame?.key, places])
  const finish = rp?.end ? replaySummary(places) : null
  function startReplay() {
    planned.current++; setPicks([]); setCrawl(null); setPickNote(''); setPicking(false); setHeatOn(false)
    setSel(null); setArea(null); setHover(null)
    document.querySelector('.nearmap')?.scrollIntoView({ block: 'center', behavior: reduce() ? 'auto' : 'smooth' })   // on phones the map sits below the controls
    setRp(reduce() ? { i: frames.length - 1, playing: false, end: true } : { i: 0, playing: true, end: false })
  }
  // one frame every 900 ms; after the last one, the summary
  useEffect(() => {
    if (!rp || !rp.playing || rp.end) return
    const t = setTimeout(() => setRp(r => (r.i >= frames.length - 1 ? { ...r, playing: false, end: true } : { ...r, i: r.i + 1 })), 900)
    return () => clearTimeout(t)
  }, [rp, frames.length])
  // heatmap: journal places only (no wishes); food home is named in the caption
  const heatPlaces = useMemo(() => (heatOn ? shown.filter(x => x.kind === 'place') : []), [heatOn, shown])
  const heat = useMemo(() => (heatOn ? heatPoints(heatPlaces) : null), [heatOn, heatPlaces])
  const home = useMemo(() => (heatOn ? foodHome(heatPlaces) : null), [heatOn, heatPlaces])
  const markers = useMemo(() => replayPins ? replayPins.now : [
    // your dot only when it's in the same view (not a 100 km zoom-out to Vadodara)
    ...(me && (city === ALL || city === homeCity(located, me)) ? [{ id: 'me', kind: 'me', ...me, title: 'You are here' }] : []),
    ...shown.map(x => ({ id: x.key, kind: x.kind, lat: x.lat, lng: x.lng, title: x.name, label: x.name, sub: x.kind === 'place' ? placeSummary(x).mustTry : null, approx: !isExact(x), num: numOf.get(x.key), color: x.kind === 'place' ? pinColor(bestRating(x)) : undefined, initial: group ? adderInitial(x.user_id, names, uid) : undefined })),
  ], [me, shown, group, names, uid, city, located, numOf, replayPins])

  // a quiet line under the results (not a banner): hide it with ×; it comes back only if more pile up
  const fixHint = showFixHint(missing, hiddenAt) && (
    <p className="nearhint">
      <span>{missing} {missing === 1 ? 'place has' : 'places have'} no location yet, so {missing === 1 ? 'it isn’t' : 'they aren’t'} shown here.</span>
      <button type="button" className="tbtn font-semibold" style={{ color: 'var(--pri)' }} onClick={onFix}>Add them</button>
      <button type="button" className="ghost ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full" onClick={hideHint} aria-label="Hide this hint"><Icon name="x" size={14} /></button>
    </p>
  )

  if (!ready) return (
    <div className="fade py-14 text-center">
      <span className="qicon mx-auto mb-4 !h-16 !w-16" style={{ background: 'var(--soft)', color: 'var(--mute)' }}><Icon name="locate" size={28} /></span>
      <p className="m-0 text-lg font-bold">Near me isn’t switched on yet</p>
      <p className="mx-auto mt-1 max-w-xs text-sm" style={mute}>It needs a one-time update on the server before places can keep a location.</p>
    </div>
  )

  if (locating && city === null) return (
    <div className="fade py-16 text-center" role="status">
      <span className="qicon mx-auto mb-4 !h-16 !w-16 nearpulse" style={{ background: 'var(--pri-soft)', color: 'var(--pri)' }}><Icon name="locate" size={28} /></span>
      <p className="m-0 font-semibold">Finding where you are…</p>
      <p className="m-0 mt-1 text-sm" style={mute}>Your location stays on this phone. It isn’t saved.</p>
    </div>
  )

  const hereCard = guess && (
    <div className="herecard fade" role="status">
      <p className="m-0"><Icon name="locate" size={15} /> <span>You’re near <b>{guess.name}</b>. Save where you are as its exact spot?</span></p>
      {saveErr && <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--bad)' }} role="alert">{saveErr}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" className="btn btn-pri !px-3.5 !py-1.5 !text-sm" onClick={saveHere} disabled={saving}>{saving ? 'Saving…' : 'Save exact spot'}</button>
        <button type="button" className="btn !px-3.5 !py-1.5 !text-sm" onClick={notNow} disabled={saving}>Not now</button>
      </div>
    </div>
  )
  const where = near ? `within ${near} km` : city && city !== ALL ? `in ${city}` : 'in all cities'
  return (
    <div>
      {/* list / map + your location */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="seg nearseg" role="tablist" aria-label="Show as">
          <button role="tab" aria-selected={mode === 'list'} className={mode === 'list' ? 'on' : ''} onClick={() => chooseMode('list')}><Icon name="list" size={15} /> List</button>
          <button role="tab" aria-selected={mode === 'map'} className={mode === 'map' ? 'on' : ''} onClick={() => chooseMode('map')}><Icon name="map" size={15} /> Map</button>
        </div>
        <ChipSelect label="Distance from you" value={near || ''} active={!!near} disabled={!me}
          title={me ? undefined : 'Turn on your location to filter by distance'}
          options={[['', radiusLabel(null)], ...RADII.map(km => [km, radiusLabel(km)])]} onChange={v => chooseRadius(v || null)} />
        {adders.length > 2 && (
          <ChipSelect label="Added by" value={by} active={!!by} options={adders} onChange={v => { setBy(v); setSel(null); setArea(null); setOnly(null) }} />
        )}
        {mode === 'map' && anyLocated && (
          <button type="button" className={`chip ${picking ? 'on' : ''}`} aria-pressed={picking} onClick={togglePick} disabled={!!rp}><Icon name="navigate" size={15} /> Plan a route</button>
        )}
        {mode === 'map' && anyLocated && (
          <button type="button" className={`chip ${heatOn ? 'on' : ''}`} aria-pressed={heatOn} onClick={() => setHeatOn(!heatOn)} disabled={!!rp}><Icon name="sparkle" size={15} /> Heatmap</button>
        )}
        {mode === 'map' && frames.length >= 2 && (
          <button type="button" className="chip" onClick={startReplay} disabled={!!rp}><Icon name="play" size={15} /> Replay</button>
        )}
        <button className="chip ml-auto" onClick={locate} disabled={locating} aria-label={me ? 'Update my location' : 'Use my location'} title={me ? 'Update my location' : undefined}>
          <Icon name="locate" size={15} /> <span className={me ? 'max-sm:hidden' : ''}>{locating ? 'Locating…' : me ? 'Update' : 'Use my location'}</span>
        </button>
      </div>

      {err && !me && (
        <p className="fade nearwarn" role="status"><Icon name="locate" size={15} /> {HELP[err] || HELP.unavailable}</p>
      )}

      <div className="nearchips mb-3">
        {cities.length > 1 && (
          <>
            <span role="group" aria-label="City" className="contents">
              {[ALL, ...cities].map(c => (
                <button key={c} className={`chip ${city === c ? 'on' : ''}`} aria-pressed={city === c} onClick={() => chooseCity(c)}>
                  {c === ALL ? 'All cities' : c}
                </button>
              ))}
            </span>
            <span className="nearsep" aria-hidden="true" />
          </>
        )}
        {CATEGORIES.map(c => (
          <button key={c} className={`chip ${cat === c ? 'on' : ''}`} aria-pressed={cat === c} onClick={() => { setCat(cat === c ? ALL : c); setSel(null); setArea(null); setOnly(null) }}>{c}</button>
        ))}
        <button className={`chip ${again ? 'on' : ''}`} aria-pressed={again} onClick={() => { setAgain(!again); setSel(null); setArea(null); setOnly(null) }}>Order again</button>
        <button className={`chip ${wishes ? 'on' : ''}`} aria-pressed={wishes} onClick={() => { setWishes(!wishes); setSel(null); setArea(null); setOnly(null) }}><Icon name="bookmark" size={14} /> Want to try</button>
      </div>

      {only && (
        <button type="button" className="areachip mb-3" onClick={() => setOnly(null)} aria-label={`Clear the ${only.name} filter`}>
          × {only.name}
        </button>
      )}

      {hereCard}

      {!anyLocated ? (
        <div className="fade py-12 text-center">
          <p className="m-0 font-semibold">No place has a location yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm" style={mute}>Places get one from their landmark and city automatically, or exactly with Find on Google Maps.</p>
          {missing > 0 && <button className="btn btn-pri mt-4 !py-2 !text-sm" onClick={onFix}><Icon name="map" size={16} /> Add locations</button>}
        </div>
      ) : !shown.length && !rp ? (
        <div className="fade py-10 text-center">
          <p className="m-0 font-semibold">Nothing {where}</p>
          {near ? (
            <button className="btn mt-3 !py-2 !text-sm" onClick={() => chooseRadius(wider)}>
              {wider ? `Show ${radiusLabel(wider).toLowerCase()}` : 'Show any distance'}
            </button>
          ) : <p className="m-0 mt-1 text-sm" style={mute}>Try another city, or fewer filters.</p>}
        </div>
      ) : mode === 'map' ? (
        <div className="nearsplit">
          <LeafletMap className={`nearmap ${heatOn ? 'heat-on' : ''} ${full ? 'nearmap-full' : ''}`} heat={heat} center={me || shown[0] || INDIA} zoom={12} fit cluster markers={markers} frameOn={replayPins?.all} selected={rp || picking ? null : hover || sel} circle={ring} frameRoute={!!crawl?.trip && !rp} route={rp ? null : crawl?.trip?.line || (picking ? null : tripNow?.line)}
            onMarker={id => { if (rp) return; setArea(null); if (id === 'me') setSel(null); else if (picking) pick(id); else setSel(id) }} onView={setBox}
            onCluster={(ids, zoomIn) => { setSel(null); if (rp || full) zoomIn(); else setArea({ ids, zoomIn }) }} label={rp ? 'Map replaying your food year' : `Map of places ${where}`}>
            {rp && frame && <FoodReplay frame={frame} total={frame.ids.length} playing={rp.playing} summary={finish}
              onToggle={() => setRp(r => ({ ...r, playing: !r.playing }))} onSkip={() => setRp(r => ({ ...r, i: frames.length - 1, playing: false, end: true }))} onClose={() => setRp(null)} />}
            <button type="button" className="nearfull" aria-label={full ? 'Exit full screen' : 'Full screen'} aria-pressed={full} onClick={() => setFull(f => !f)}>
              {full ? <Icon name="x" size={18} /> : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>}
            </button>
            {full && <FullLayer onClose={() => setFull(false)} />}
            {full && picked && !picking && !rp && <div className="nearfloat"><NearCard x={picked} onOpenPlace={id => { setFull(false); onOpenPlace(id) }} onClose={() => setSel(null)} trip={tripNow} pop /></div>}
          </LeafletMap>
          {rp ? <div className="nearside"><p className="m-0 mt-2 text-center text-[13px]" style={mute}>Replaying your food year. Pins appear in the order you added them.</p></div> : <div className="nearside">
            {picking && <CrawlBar count={stops.length} busy={!!crawl?.busy} trip={crawl?.trip} failed={!!crawl?.failed} note={pickNote}
              approx={stops.some(x => !isExact(x))} url={googleDirectionsUrl(me, ordered)} onPlan={plan} onClear={endCrawl} />}
            {summary && <div ref={popRef} className="nearareacard">
              <AreaCard summary={summary} onZoom={() => area.zoomIn()} onClose={() => setArea(null)}
                onShow={() => { setOnly({ ids: area.ids, name: summary.name || 'This area' }); setArea(null) }} /></div>}
            {home && <p className="m-0 mt-2 text-center text-[13px] font-semibold" style={{ color: 'var(--pri)' }}>Your food home: {home.name} ({home.count} places)</p>}
            <p className="m-0 mt-2 text-center text-[13px]" style={mute} aria-live="polite">
              {view && inView.length < shown.length
                ? `${inView.length} ${inView.length === 1 ? 'place' : 'places'} in this area`
                : `${shown.length} ${shown.length === 1 ? 'place' : 'places'} ${where}. Tap a pin for details.${shown.some(x => !isExact(x)) ? ' Hollow pins are placed by their area.' : ''}`}</p>
            <div className="nearrail" ref={railRef} role="list" aria-label="Places in this area">
              {railItems.map((x, i) => (
                <div key={x.key} data-key={x.key} role="listitem" className={`nearitem ${x.key === sel ? 'on' : ''} ${numOf.has(x.key) ? 'picked' : ''}`}
                  onMouseEnter={() => wide() && setHover(x.key)} onMouseLeave={() => setHover(null)}>
                  {x === offView && <p className="nearoff">Selected · off this view</p>}
                  <NearCard x={x} index={i} onOpenPlace={onOpenPlace} onClose={x.key === sel ? () => setSel(null) : undefined} trip={x.key === sel ? tripNow : null}
                    pick={picking ? { num: numOf.get(x.key), on: () => pick(x.key) } : null} />
                </div>
              ))}
            </div>
          </div>}
        </div>
      ) : (
        <>
          <p className="mb-3 mt-1 text-[13px] font-semibold" style={mute}>{shown.length} {shown.length === 1 ? 'place' : 'places'} {where}{me ? ', nearest first' : ''}</p>
          <div className="place-grid">
            {shown.map((x, i) => <NearCard key={x.key} x={x} index={i} onOpenPlace={onOpenPlace} />)}
          </div>
        </>
      )}

      {anyLocated && fixHint}
    </div>
  )
}

// full screen is a layer: Esc closes it (top of the stack) and the page behind can't scroll
function FullLayer({ onClose }) { useEscape(onClose); useScrollLock(); return null }

// one place or wish with its distance; Directions opens Google Maps navigation to the exact spot
function NearCard({ x, index = 0, onOpenPlace, onClose, trip = null, pop = false, pick = null }) {
  const s = x.kind === 'place' ? placeSummary(x) : null
  const where = placeWhere(x)
  const mute = { color: 'var(--mute)' }
  const body = (
    <>
      <span className="mono h-12 w-12 text-lg" style={{ background: tileColor(x) }}>{x.name.trim()[0]?.toUpperCase()}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="truncate text-[15.5px] font-bold leading-snug">{x.name}</span>
          {x.km != null && <span className={`neardist ${isExact(x) ? '' : 'approx'}`} title={isExact(x) ? 'Exact location' : 'Approximate: placed by its area'}>{distanceLabel(x)}</span>}
        </span>
        <span className="mt-0.5 block truncate text-[13px]" style={mute}>{[where, (x.categories || []).join(' · ')].filter(Boolean).join(' · ')}</span>
        {trip && <span className="neartrip mt-0.5 block text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{tripLabel(trip, !isExact(x))} · {walkMinutes(trip.km)} min walk</span>}
        {x.kind === 'wish'
          ? <span className="mt-1 flex items-center gap-1 text-[13px] font-semibold" style={{ color: 'var(--accent-ink)' }}><Icon name="bookmark" size={13} /> Want to try{x.note ? <span className="truncate font-normal" style={mute}> · {x.note}</span> : null}</span>
          : s?.mustTry && <span className="mt-1 block truncate text-[13px]"><span style={{ color: 'var(--accent-ink)' }}>Must try:</span> {s.mustTry}</span>}
      </span>
    </>
  )
  return (
    <article className={`nearcard ${pop ? 'pop' : 'rise'}`} style={pop ? null : { animationDelay: `${Math.min(index, 10) * 35}ms` }}>
      {pick
        ? <button type="button" className="nearcard-main" onClick={pick.on} aria-pressed={!!pick.num} aria-label={`${pick.num ? `Remove ${x.name} from the route` : `Add ${x.name} to the route`}`}>{body}</button>
        : x.kind === 'place'
        ? <button type="button" className="nearcard-main" onClick={() => onOpenPlace(x.id)} aria-label={x.km != null ? `${x.name}, ${distanceLabel(x)} away` : x.name}>{body}</button>
        : <div className="nearcard-main">{body}</div>}
      <div className="flex items-center gap-2 px-3.5 pb-3">
        <a className="btn btn-pri !px-3.5 !py-1.5 !text-sm" href={directionsUrl(x)} target="_blank" rel="noopener noreferrer"><Icon name="navigate" size={15} /> Directions</a>
        {pick
          ? <button type="button" className={`btn !px-3.5 !py-1.5 !text-sm ${pick.num ? 'btn-pri' : ''}`} onClick={pick.on}>{pick.num ? `Added · ${pick.num}` : 'Add to route'}</button>
          : x.kind === 'place' && <button type="button" className="btn !px-3.5 !py-1.5 !text-sm" onClick={() => onOpenPlace(x.id)}>Details</button>}
        {onClose && <button type="button" className="ghost ml-auto grid h-8 w-8 place-items-center rounded-full" style={mute} onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>}
      </div>
    </article>
  )
}
