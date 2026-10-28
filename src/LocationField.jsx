import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icons'
import LeafletMap from './LeafletMap'
import PinPicker, { INDIA } from './PinPicker'
import GoogleLocate from './GoogleLocate'
import MapsLinkField from './MapsLinkField'
import { useEscape, useScrollLock } from './layers'
import { getPosition, GOOD_ACCURACY } from './locate'
import { guessSpot } from './geocode'
import { isMapsLink } from './mapsLink'
import { distanceKm, isExact } from './geo'
import { locationFromLink } from './locationValue'
import { useLocationReady } from './locationReady'
import { askConfirm } from './dialogs'

const HOW = { gps: 'Set with GPS', link: 'From Google Maps', pin: 'Pinned on the map', area: 'Placed by its area (≈)' }
export const GPS_HELP = {
  denied: 'Location is blocked for this site. Allow it in your browser’s site settings, or use Find on Google Maps.',
  unavailable: 'Couldn’t get a GPS fix. Try again outdoors, or use Find on Google Maps.',
  timeout: 'GPS took too long. Try again outdoors, or use Find on Google Maps.',
  unsupported: 'This browser can’t share your location. Use Find on Google Maps instead.',
}
export const NO_SPOT = 'That link has no exact spot in it. In Google Maps, long-press the place to drop a pin, then Share → Copy link and paste again.'

// Full-height map sheet to fine-tune a pin (or place one by hand). Above the form it was opened from.
// With no pin yet it starts on the area or city (never a guessed shop: those were often wrong).
export function MapSheet({ title = 'Place it on the map', start, place, note: startNote, onUse, onClose }) {
  useEscape(onClose)
  useScrollLock()
  const [pin, setPin] = useState(start ? { lat: start.lat, lng: start.lng } : null)
  const [view, setView] = useState(start ? { lat: start.lat, lng: start.lng, zoom: 17 } : null)
  const [note, setNote] = useState(startNote || '')
  const [guessing, setGuessing] = useState(!start)

  useEffect(() => {
    if (start) return
    let live = true
    guessSpot({ area: place?.area, city: place?.city }).then(g => {
      if (!live) return
      setGuessing(false)
      setView(g ? { lat: g.lat, lng: g.lng, zoom: g.zoom } : INDIA)
      setNote('Search a street or landmark, or tap the map where the place is.')
    })
    return () => { live = false }
  }, [])

  return createPortal(
    <>
      <div className="scrim !z-[50]" onMouseDown={onClose} />
      <div className="mapsheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
          <h2 className="m-0 text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="ghost grid h-9 w-9 place-items-center rounded-full" style={{ color: 'var(--mute)' }}><Icon name="x" size={18} /></button>
        </div>
        {guessing
          ? <div className="lmap-msg !static flex-1"><span className="scanbar w-24" aria-hidden="true" /> Opening the map…</div>
          : <PinPicker value={pin} onChange={p => { setPin(p); setNote('') }} view={view} bias={view && view.zoom > 5 ? view : null} className="flex-1 px-4" />}
        <div className="px-4 pb-4 pt-2">
          <p className="m-0 mb-2 min-h-[1.25em] text-xs" style={{ color: 'var(--mute)' }} aria-live="polite">{note || (pin ? 'Drag the pin or tap the map to fine-tune.' : '')}</p>
          <div className="flex gap-2">
            <button type="button" className="btn flex-1" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-pri flex-[2]" disabled={!pin} onClick={() => onUse(pin)}>Use this spot</button>
          </div>
        </div>
      </div>
    </>,
    document.body)
}

// "Exact location" in the place and Want to try forms. Main way: Find on Google Maps -> Copy link ->
// Paste link (Google finds it; the link carries the exact spot). Also I'm here (GPS) and a map pin.
// value = { lat, lng, loc_source } or null. place.maps_url is the form's Google Maps link and
// onLink(link) sets it; the position is read from it. The link box itself is only a fallback here
// (typing / pasting by hand); before the location update has run on the server it's all there is.
export default function LocationField({ value, onChange, place, onLink }) {
  const ready = useLocationReady()
  const [byHand, setByHand] = useState(false)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)              // { tone: 'ok' | 'bad' | 'info', text }
  const [sheet, setSheet] = useState(null)          // { start, note }
  const [acc, setAcc] = useState(null)              // GPS accuracy, this session only
  const latest = useRef(value)
  latest.current = value

  // a Google Maps link in the form: take the position from it (asking before replacing one).
  // The link the form opened with only fills an empty location, silently.
  const link = (place?.maps_url || '').trim()
  const openedWith = useRef(link)
  useEffect(() => {
    const initial = link === openedWith.current
    if (!ready || !isMapsLink(link) || (initial && isExact(latest.current))) return
    let live = true
    const t = setTimeout(async () => {
      setBusy('link')
      const loc = await locationFromLink(link)
      if (!live) return
      setBusy('')
      if (!loc) { if (!initial) setMsg({ tone: 'bad', text: NO_SPOT }); return }
      const cur = latest.current
      if (isExact(cur) && distanceKm(cur, loc) > 0.02) {           // an area-level one is simply upgraded
        const ok = await askConfirm({
          title: 'Use the link’s location?', message: 'This place already has an exact location. Replace it with the spot from the Google Maps link?',
          confirmLabel: 'Use the link', cancelLabel: 'Keep mine',
        })
        if (!ok || !live) return
      }
      setAcc(null)
      onChange(loc)
      setMsg({ tone: 'ok', text: 'Exact spot read from the Google Maps link.' })
    }, 300)
    return () => { live = false; clearTimeout(t) }
  }, [link, ready])

  async function pasted(l) {
    if (onLink) return onLink(l)                      // the field's effect reads it
    setBusy('link')
    const loc = await locationFromLink(l)
    setBusy('')
    if (loc) { onChange(loc); setMsg({ tone: 'ok', text: 'Exact spot read from the Google Maps link.' }) }
    else setMsg({ tone: 'bad', text: NO_SPOT })
  }

  async function here() {
    setBusy('gps'); setMsg(null)
    try {
      const p = await getPosition()
      if (p.acc <= GOOD_ACCURACY) {
        onChange({ lat: p.lat, lng: p.lng, loc_source: 'gps' }); setAcc(Math.round(p.acc))
      } else {
        setSheet({ start: p, note: `Your GPS is only accurate to ±${Math.round(p.acc)} m here. Drag the pin onto the place, or try again outdoors.` })
      }
    } catch (err) {
      setMsg({ tone: 'bad', text: GPS_HELP[err.code] || GPS_HELP.unavailable })
    }
    setBusy('')
  }

  const linkBox = <MapsLinkField value={place?.maps_url || ''} onChange={onLink} place={place} />
  if (!ready) return linkBox                         // saving locations isn't switched on yet (migration)
  const mute = { color: 'var(--mute)' }
  return (
    <div className="mb-3">
      <span className="mb-1 block text-xs font-medium" style={mute}>Exact location <span className="font-normal">(for Near me and directions)</span></span>
      {isExact(value) ? (
        <div className="locset">
          <LeafletMap still className="locset-map" center={value} zoom={16} pin={value} label="Saved location" />
          <div className="flex flex-wrap items-center gap-2 p-2.5">
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--ok)' }}>
              <Icon name="check" size={15} stroke={2.6} /> {HOW[value.loc_source] || 'Location set'}{value.loc_source === 'gps' && acc != null ? ` ±${acc} m` : ''}
            </span>
            <button type="button" className="btn !px-3 !py-1.5 !text-sm" onClick={() => setSheet({ start: value })}>Adjust</button>
            <button type="button" className="btn !px-3 !py-1.5 !text-sm" style={{ color: 'var(--bad)' }} onClick={() => { onChange(null); setMsg(null); setAcc(null) }}>Remove</button>
          </div>
        </div>
      ) : (
        <>
          {value && (
            <p className="m-0 mb-2 flex flex-wrap items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--accent-ink)' }}>
              <Icon name="pin" size={15} /> Placed by its area (≈). For the exact spot:
              <button type="button" className="tbtn ml-auto text-xs font-semibold" style={{ color: 'var(--bad)' }}
                onClick={() => { onChange(null); setMsg(null) }}>Remove</button>
            </p>
          )}
          <GoogleLocate place={place} onLink={pasted} onBlocked={() => setByHand(true)} busy={busy === 'link'} />
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-semibold">
            <button type="button" className="tbtn inline-flex items-center gap-1" style={{ color: 'var(--pri)' }} onClick={here} disabled={!!busy}>
              <Icon name="locate" size={15} /> {busy === 'gps' ? 'Locating…' : 'I’m here now'}
            </button>
            <button type="button" className="tbtn inline-flex items-center gap-1" style={{ color: 'var(--pri)' }} onClick={() => setSheet({})} disabled={!!busy}>
              <Icon name="pin" size={15} /> Place it on a map
            </button>
            {!byHand && <button type="button" className="tbtn inline-flex items-center gap-1" style={{ color: 'var(--mute)' }} onClick={() => setByHand(true)}>
              Paste the link by hand
            </button>}
          </div>
          {byHand && <div className="fade mt-2">{linkBox}</div>}
          {!value && <p className="m-0 mt-1.5 text-xs" style={mute}>Optional. Skip it and BiteMark places it by its landmark and city on its own (≈).</p>}
        </>
      )}
      {(msg || busy === 'link') && (
        <p className="m-0 mt-1 text-xs" role="status"
          style={msg?.tone === 'bad' ? { color: 'var(--bad)' } : msg?.tone === 'ok' ? { color: 'var(--ok)' } : mute}>
          {busy === 'link' ? 'Reading the spot from the link…' : msg.text}
        </p>
      )}
      {sheet && (
        <MapSheet start={sheet.start} note={sheet.note} place={place}
          onClose={() => setSheet(null)}
          onUse={p => { onChange({ lat: p.lat, lng: p.lng, loc_source: 'pin' }); setAcc(null); setMsg(null); setSheet(null) }} />
      )}
    </div>
  )
}
