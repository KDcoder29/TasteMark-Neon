import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icons'
import { supabase } from './supabase'
import { useEscape, useScrollLock } from './layers'
import { useSheetDrag } from './useGestures'
import { locationFromLink } from './locationValue'
import { parseSharedPlace, rankMatches } from './shareTarget'

// A place shared from Google Maps: find its exact spot, then either save it on a place you already
// have, or start a new place / Want to try entry. Saving is your own tap, so it may replace a spot.
export default function SharedPlaceSheet({ data, candidates, loadError, onClose, onSaved, onAdd }) {
  const drag = useSheetDrag(onClose)
  useEscape(onClose)
  useScrollLock()
  const cities = useMemo(() => [...new Set([...candidates.map(c => c.city).filter(Boolean), 'Vadodara', 'Ahmedabad'])], [candidates])
  const shared = useMemo(() => parseSharedPlace(data, cities), [data, cities])
  const matches = useMemo(() => rankMatches(shared, candidates), [shared, candidates])
  const [spot, setSpot] = useState(undefined)         // undefined = looking, null = none found
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    if (!shared.link) { setSpot(null); return }
    locationFromLink(shared.link).then(s => { if (live) setSpot(s) }, () => { if (live) setSpot(null) })
    return () => { live = false }
  }, [shared.link])

  async function save(m) {
    setBusy(true); setError('')
    const row = { lat: spot.lat, lng: spot.lng, loc_source: 'link', maps_url: shared.link }
    const { data: done, error: err } = await supabase.from(m.table).update(row).eq('id', m.id).select('id')
    setBusy(false)
    if (err) return setError(err.message)
    if (!done?.length) return setError('Couldn’t save: you can’t edit this place')
    onSaved(m.name)
  }

  const prefill = {
    name: shared.name, city: shared.city, area: shared.area, categories: [],
    maps_url: shared.link, ...(spot ? { lat: spot.lat, lng: spot.lng, loc_source: 'link' } : {}),
  }
  const mute = { color: 'var(--mute)' }
  const looking = spot === undefined

  return createPortal(
    <>
      <div className="scrim !z-[50]" onMouseDown={onClose} />
      <div ref={drag} className="drawer !z-[51] lg:!w-[460px]" role="dialog" aria-modal="true" aria-label="Shared place">
        <div className="grabber" />
        <div className="flex items-center justify-between px-5 pb-1 pt-2">
          <h2 className="m-0 text-lg font-bold">Shared from Google Maps</h2>
          <button onClick={onClose} aria-label="Close" className="ghost grid h-9 w-9 place-items-center rounded-full" style={mute}><Icon name="x" size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-6">
          <p className="m-0 text-[17px] font-bold">{shared.name || 'A place'}</p>
          {shared.address && <p className="m-0 mt-0.5 text-sm" style={mute}>{shared.address}</p>}
          <p className="m-0 mt-3 text-sm" style={mute} role="status">
            {!shared.link ? 'No Google Maps place link in what you shared'
              : looking ? 'Finding the exact spot…'
              : spot ? 'Found its exact spot.' : 'Couldn’t read the exact spot from that link'}
          </p>
          {loadError && <p className="m-0 mt-1 text-sm" style={mute}>Couldn’t load your places to match</p>}
          {spot && matches.length > 0 && (
            <div className="mt-3 space-y-2">
              {matches.map(m => (
                <div key={m.table + m.id}>
                <button disabled={busy} onClick={() => save(m)} className="btn w-full !justify-start text-left">
                  <Icon name="pin" size={16} />
                  <span className="min-w-0 flex-1 leading-snug">Save as the exact spot for {m.name}</span>
                  <span className="text-xs" style={mute}>{m.table === 'wishlist' ? 'Want to try' : m.city || ''}</span>
                </button>
                {['gps', 'link', 'pin'].includes(m.loc_source) && <p className="m-0 mt-1 px-1 text-xs" style={mute}>Replaces its current exact spot</p>}
                </div>
              ))}
            </div>
          )}
          {error && <p className="m-0 mt-2 text-sm" style={{ color: 'var(--bad, #c0392b)' }}>{error}</p>}
          <div className="mt-4 flex flex-col gap-2">
            <button disabled={looking} className="btn btn-pri" onClick={() => onAdd('place', prefill)}>Add as a new place</button>
            <button disabled={looking} className="btn" onClick={() => onAdd('wish', prefill)}>Add to Want to try</button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
