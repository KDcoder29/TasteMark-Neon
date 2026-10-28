import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icons'
import LeafletMap from './LeafletMap'
import { tileColor } from './PlaceCard'
import { CATEGORIES } from './shared'
import { placeSummary, placeWhere } from './placeView'
import { filterPlaces, NO_FILTERS } from './journalFilter'
import { getPosition } from './locate'
import { sortByDistance, homeCity, isLocated, isExact, distanceLabel, directionsUrl, bestRating, pinColor } from './geo'
import { showFixHint } from './locationSupport'
import { useLocationReady } from './locationReady'

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
// No distance limit: pick a city to see all of its places (e.g. Vadodara while you're in Ahmedabad).
// It starts on the city you're in. Without your location it still works, just without distances.
// Your own position stays on this screen: it's never saved or sent anywhere.
export default function NearMe({ places, wishlist, toFix = 0, onOpenPlace, onFix }) {
  const [me, setMe] = useState(null)
  const [err, setErr] = useState('')
  const [locating, setLocating] = useState(true)
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('near.mode') || 'list' } catch { return 'list' } })
  const [city, setCity] = useState(null)           // null until it settles on the city you're in
  const [cat, setCat] = useState(ALL)
  const [again, setAgain] = useState(false)
  const [wishes, setWishes] = useState(true)
  const [sel, setSel] = useState(null)
  const popRef = useRef(null)
  const ready = useLocationReady()
  const [hiddenAt, setHiddenAt] = useState(() => { try { const v = localStorage.getItem(HINT); return v == null ? null : +v } catch { return null } })
  const hideHint = () => { setHiddenAt(toFix); try { localStorage.setItem(HINT, String(toFix)) } catch {} }
  // phones: the tapped pin's card opens under the map; bring it into view
  useEffect(() => { if (sel) popRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [sel])

  async function locate() {
    setLocating(true); setErr('')
    try { const p = await getPosition(); setMe({ lat: p.lat, lng: p.lng }) }
    catch (e) { setErr(e.code || 'unavailable') }
    setLocating(false)
  }
  useEffect(() => { locate() }, [])
  const chooseMode = m => { setMode(m); setSel(null); try { localStorage.setItem('near.mode', m) } catch {} }

  const items = useMemo(() => [
    ...filterPlaces(places, { ...NO_FILTERS, cat, again }).map(p => ({ ...p, kind: 'place', key: 'p' + p.id })),
    ...(wishes && !again ? wishlist.filter(w => cat === ALL || (w.categories || []).includes(cat)).map(w => ({ ...w, kind: 'wish', key: 'w' + w.id })) : []),
  ], [places, wishlist, cat, again, wishes])
  const located = useMemo(() => [...places, ...wishlist].filter(isLocated), [places, wishlist])
  const cities = useMemo(() => [...new Set(located.map(p => (p.city || '').trim()).filter(Boolean))].sort(), [located])

  // start on the city you're in (once your position is known, or known to be unavailable)
  useEffect(() => {
    if (city !== null || locating) return
    const here = homeCity(located, me)
    setCity(here && cities.length > 1 ? here : ALL)
  }, [locating, me, located, cities.length])
  const inCity = city && city !== ALL ? items.filter(x => (x.city || '').trim() === city) : items
  const shown = useMemo(() => sortByDistance(inCity, me), [inCity, me])
  const missing = toFix
  const anyLocated = located.length > 0
  const picked = shown.find(x => x.key === sel)
  const mute = { color: 'var(--mute)' }

  const markers = useMemo(() => [
    // your dot only when it's in the same view (not a 100 km zoom-out to Vadodara)
    ...(me && (city === ALL || city === homeCity(located, me)) ? [{ id: 'me', kind: 'me', ...me, title: 'You are here' }] : []),
    ...shown.map(x => ({ id: x.key, kind: x.kind, lat: x.lat, lng: x.lng, title: x.name, approx: !isExact(x), color: x.kind === 'place' ? pinColor(bestRating(x)) : undefined })),
  ], [me, shown, city, located])

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

  const where = city && city !== ALL ? city : 'all cities'
  return (
    <div>
      {/* list / map + your location */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="seg nearseg" role="tablist" aria-label="Show as">
          <button role="tab" aria-selected={mode === 'list'} className={mode === 'list' ? 'on' : ''} onClick={() => chooseMode('list')}><Icon name="list" size={15} /> List</button>
          <button role="tab" aria-selected={mode === 'map'} className={mode === 'map' ? 'on' : ''} onClick={() => chooseMode('map')}><Icon name="map" size={15} /> Map</button>
        </div>
        <button className="chip ml-auto" onClick={locate} disabled={locating} aria-label="Update my location">
          <Icon name="locate" size={15} /> {locating ? 'Locating…' : me ? 'Update' : 'Use my location'}
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
                <button key={c} className={`chip ${city === c ? 'on' : ''}`} aria-pressed={city === c} onClick={() => { setCity(c); setSel(null) }}>
                  {c === ALL ? 'All cities' : c}
                </button>
              ))}
            </span>
            <span className="nearsep" aria-hidden="true" />
          </>
        )}
        {CATEGORIES.map(c => (
          <button key={c} className={`chip ${cat === c ? 'on' : ''}`} aria-pressed={cat === c} onClick={() => setCat(cat === c ? ALL : c)}>{c}</button>
        ))}
        <button className={`chip ${again ? 'on' : ''}`} aria-pressed={again} onClick={() => setAgain(!again)}>Order again</button>
        <button className={`chip ${wishes ? 'on' : ''}`} aria-pressed={wishes} onClick={() => setWishes(!wishes)}><Icon name="bookmark" size={14} /> Want to try</button>
      </div>

      {!anyLocated ? (
        <div className="fade py-12 text-center">
          <p className="m-0 font-semibold">No place has a location yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm" style={mute}>Places get one from their landmark and city automatically, or exactly with Find on Google Maps.</p>
          {missing > 0 && <button className="btn btn-pri mt-4 !py-2 !text-sm" onClick={onFix}><Icon name="map" size={16} /> Add locations</button>}
        </div>
      ) : !shown.length ? (
        <div className="fade py-10 text-center">
          <p className="m-0 font-semibold">Nothing here in {where}</p>
          <p className="m-0 mt-1 text-sm" style={mute}>Try another city, or fewer filters.</p>
        </div>
      ) : mode === 'map' ? (
        <div>
          <LeafletMap className="nearmap" center={me || shown[0] || INDIA} zoom={12} fit markers={markers} selected={sel}
            onMarker={id => setSel(id === 'me' ? null : id)} label={`Map of places in ${where}`} />
          {picked ? <div ref={popRef}><NearCard x={picked} onOpenPlace={onOpenPlace} onClose={() => setSel(null)} pop /></div>
            : <p className="m-0 mt-2 text-center text-[13px]" style={mute}>
              {shown.length} {shown.length === 1 ? 'place' : 'places'} in {where}. Tap a pin for details.{shown.some(x => !isExact(x)) ? ' Hollow pins are placed by their area.' : ''}</p>}
        </div>
      ) : (
        <>
          <p className="mb-3 mt-1 text-[13px] font-semibold" style={mute}>{shown.length} {shown.length === 1 ? 'place' : 'places'} in {where}{me ? ', nearest first' : ''}</p>
          <div className="place-grid">
            {shown.map((x, i) => <NearCard key={x.key} x={x} index={i} onOpenPlace={onOpenPlace} />)}
          </div>
        </>
      )}

      {anyLocated && fixHint}
    </div>
  )
}

// one place or wish with its distance; Directions opens Google Maps navigation to the exact spot
function NearCard({ x, index = 0, onOpenPlace, onClose, pop = false }) {
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
        {x.kind === 'wish'
          ? <span className="mt-1 flex items-center gap-1 text-[13px] font-semibold" style={{ color: 'var(--accent-ink)' }}><Icon name="bookmark" size={13} /> Want to try{x.note ? <span className="truncate font-normal" style={mute}> · {x.note}</span> : null}</span>
          : s?.mustTry && <span className="mt-1 block truncate text-[13px]"><span style={{ color: 'var(--accent-ink)' }}>Must try:</span> {s.mustTry}</span>}
      </span>
    </>
  )
  return (
    <article className={`nearcard ${pop ? 'pop' : 'rise'}`} style={pop ? null : { animationDelay: `${Math.min(index, 10) * 35}ms` }}>
      {x.kind === 'place'
        ? <button type="button" className="nearcard-main" onClick={() => onOpenPlace(x.id)} aria-label={x.km != null ? `${x.name}, ${distanceLabel(x)} away` : x.name}>{body}</button>
        : <div className="nearcard-main">{body}</div>}
      <div className="flex items-center gap-2 px-3.5 pb-3">
        <a className="btn btn-pri !px-3.5 !py-1.5 !text-sm" href={directionsUrl(x)} target="_blank" rel="noopener noreferrer"><Icon name="navigate" size={15} /> Directions</a>
        {x.kind === 'place' && <button type="button" className="btn !px-3.5 !py-1.5 !text-sm" onClick={() => onOpenPlace(x.id)}>Details</button>}
        {onClose && <button type="button" className="ghost ml-auto grid h-8 w-8 place-items-center rounded-full" style={mute} onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>}
      </div>
    </article>
  )
}
