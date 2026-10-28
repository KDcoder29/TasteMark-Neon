import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icons'
import LeafletMap from './LeafletMap'
import GoogleLocate from './GoogleLocate'
import { useEscape, useScrollLock } from './layers'
import { placeWhere } from './placeView'
import { getPosition, GOOD_ACCURACY } from './locate'
import { locationFromLink } from './locationValue'
import { findMapsLink } from './mapsLink'
import { GPS_HELP, NO_SPOT } from './LocationField'
import { supabase } from './supabase'

// "Add exact locations": one place at a time. Google Maps finds it from its name, area and city;
// you copy its Share link and paste it here; the pin shows where that is; Save & next.
// Nothing is saved without you seeing the pin. You can stop any time: saved ones stay saved.
// places = places and Want to try entries without an exact location that you may edit, each with
// .table ('places' | 'wishlist'); taken once, when it opens (see needsLocation).
export default function FixLocations({ places, onClose, onSaved }) {
  const done$ = useRef(0)
  const finish = () => (done$.current ? onSaved() : onClose())
  useEscape(finish)
  useScrollLock()
  const [queue] = useState(places)
  const [i, setI] = useState(0)
  const [pos, setPos] = useState(null)             // { lat, lng, loc_source, link? } for the current place
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [byHand, setByHand] = useState(false)     // the browser blocked Paste: a box to paste into
  const p = queue[i]
  const single = queue.length === 1

  useEffect(() => { setPos(null); setMsg(''); setBusy('') }, [i])
  const typed = text => { const l = findMapsLink(text); if (l) fromLink(l) }

  async function fromLink(link) {
    setBusy('link'); setMsg('')
    const loc = await locationFromLink(link)
    setBusy('')
    if (loc) setPos({ ...loc, link }); else setMsg(NO_SPOT)
  }

  async function here() {
    setBusy('gps'); setMsg('')
    try {
      const g = await getPosition()
      setPos({ lat: g.lat, lng: g.lng, loc_source: g.acc <= GOOD_ACCURACY ? 'gps' : 'pin' })
      if (g.acc > GOOD_ACCURACY) setMsg(`GPS is only accurate to ±${Math.round(g.acc)} m here. Drag the pin onto the place.`)
    } catch (err) { setMsg(GPS_HELP[err.code] || GPS_HELP.unavailable) }
    setBusy('')
  }

  async function save() {
    setBusy('save'); setMsg('')
    const row = { lat: pos.lat, lng: pos.lng, loc_source: pos.loc_source }
    if (pos.link) row.maps_url = pos.link              // the Maps button then opens this exact place too
    const { error } = await supabase.from(p.table || 'places').update(row).eq('id', p.id)
    setBusy('')
    if (error) return setMsg(error.message)
    done$.current += 1
    if (single) return onSaved()                       // one place (from its details): no summary screen
    setI(n => n + 1)
  }

  const mute = { color: 'var(--mute)' }
  const title = single ? 'Add exact location' : 'Add exact locations'

  return createPortal(
    <>
      <div className="scrim !z-[50]" onMouseDown={finish} />
      <div className="mapsheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-3">
          <h2 className="m-0 text-lg font-bold">{title} {p && !single && <span className="text-sm font-semibold" style={mute}>· {i + 1} of {queue.length}</span>}</h2>
          <button type="button" onClick={finish} aria-label="Close" className="ghost grid h-9 w-9 place-items-center rounded-full" style={mute}><Icon name="x" size={18} /></button>
        </div>
        {p ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4">
            {!single && <div className="fixbar mb-3"><span style={{ width: `${(i / queue.length) * 100}%` }} /></div>}
            <div className="fixplace">
              <p className="m-0 text-[17px] font-bold">{p.name}</p>
              <p className="m-0 text-[13px]" style={mute}>{placeWhere(p) || 'No area saved'}{p.table === 'wishlist' ? ' · Want to try' : ''}</p>
            </div>

            {pos ? (
              <>
                <LeafletMap className="fixmap" center={pos} zoom={17} pin={pos} label={`Where ${p.name} is`}
                  onPin={ll => { setPos(x => ({ ...x, ...ll, loc_source: 'pin' })); setMsg('') }} />
                <p className="m-0 mt-2 text-xs" style={msg ? { color: 'var(--bad)' } : mute} aria-live="polite">
                  {msg || (pos.loc_source === 'link' ? 'This is the spot from Google Maps. Drag the pin only if it’s off.' : 'Drag the pin or tap the map if it’s off.')}
                </p>
                <div className="mt-3 flex gap-2">
                  <button type="button" className="btn flex-1" onClick={() => { setPos(null); setMsg('') }} disabled={!!busy}>Start over</button>
                  <button type="button" className="btn btn-pri flex-[2]" onClick={save} disabled={!!busy}>
                    {busy === 'save' ? 'Saving…' : single || i === queue.length - 1 ? 'Save' : 'Save & next'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <ol className="fixsteps">
                  <li><b>Find on Google Maps</b> opens a search for this place.</li>
                  <li>If it’s the right place, tap <b>Share → Copy link</b>.</li>
                  <li>Come back and tap <b>Paste link</b>.</li>
                </ol>
                <GoogleLocate key={p.id} place={p} onLink={fromLink} onBlocked={() => setByHand(true)} busy={busy === 'link'} big />
                {byHand && (
                  <input key={'in' + p.id} className="input fade mt-2" inputMode="url" placeholder="Paste the Google Maps link here" aria-label="Google Maps link"
                    onPaste={e => { e.preventDefault(); typed(e.clipboardData.getData('text')) }} onChange={e => typed(e.target.value)} />
                )}
                {msg && <p className="m-0 mt-2 text-xs" style={{ color: 'var(--bad)' }} role="status">{msg}</p>}
                <div className="mt-auto flex items-center gap-2 pt-5">
                  <button type="button" className="btn flex-1 !text-sm" onClick={here} disabled={!!busy}>
                    <Icon name="locate" size={16} /> {busy === 'gps' ? 'Locating…' : 'I’m there now'}
                  </button>
                  <button type="button" className="btn flex-1 !text-sm" onClick={() => (single ? finish() : setI(n => n + 1))} disabled={!!busy}>
                    {single ? 'Not now' : 'Skip'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="fade flex flex-1 flex-col items-center justify-center px-6 text-center">
            <span className="qicon mb-4 !h-16 !w-16" style={{ background: 'var(--pri-soft)', color: 'var(--pri)' }}><Icon name="check" size={30} stroke={2.6} /></span>
            <p className="m-0 text-lg font-bold">{done$.current ? `Added ${done$.current} exact ${done$.current === 1 ? 'location' : 'locations'}` : 'Nothing changed'}</p>
            <p className="m-0 mt-1 max-w-xs text-sm" style={mute}>{done$.current < queue.length ? 'The ones you skipped can be added any time, from Near me or the place itself.' : 'They all show up in Near me now.'}</p>
            <button type="button" className="btn btn-pri mt-5" onClick={finish}>Done</button>
          </div>
        )}
      </div>
    </>,
    document.body)
}
