import { useEffect, useState } from 'react'
import Icon from './Icons'
import LeafletMap from './LeafletMap'
import { searchPlaces } from './geocode'

export const INDIA = { lat: 20.59, lng: 78.96, zoom: 5 }

// Search + a map with a draggable pin. Tapping the map also moves the pin.
// value = the pin { lat, lng } or null; view = where the map starts { lat, lng, zoom }.
export default function PinPicker({ value, onChange, view: startView, bias, className = '' }) {
  const [view, setView] = useState(startView || (value ? { ...value, zoom: 17 } : INDIA))
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => { if (startView) setView(startView) }, [startView?.lat, startView?.lng, startView?.zoom])

  // search 400 ms after typing stops
  useEffect(() => {
    if (q.trim().length < 3) { setResults([]); return }
    let live = true
    const t = setTimeout(async () => {
      setSearching(true)
      const r = await searchPlaces(q, bias)
      if (live) { setResults(r); setSearching(false) }
    }, 400)
    return () => { live = false; clearTimeout(t) }
  }, [q])

  function choose(r) {
    setView({ lat: r.lat, lng: r.lng, zoom: 17 })
    onChange({ lat: r.lat, lng: r.lng })
    setResults([]); setQ(r.label)
  }

  return (
    <div className={`pinpick ${className}`}>
      <div className="relative">
        <label className="searchbar !py-2">
          <Icon name="search" size={18} style={{ color: 'var(--mute)' }} />
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search a place, street or area"
            aria-label="Search the map" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (results[0]) choose(results[0]) } }} />
          {searching && <span className="scanbar w-10" aria-hidden="true" />}
        </label>
        {results.length > 0 && (
          <ul className="pinpick-results" role="listbox" aria-label="Search results">
            {results.map((r, i) => (
              <li key={i}><button type="button" role="option" aria-selected="false" onClick={() => choose(r)}>
                <Icon name="pin" size={15} /> <span>{r.label}</span>
              </button></li>
            ))}
          </ul>
        )}
      </div>
      <LeafletMap className="pinpick-map" center={view} zoom={view.zoom} pin={value} onPin={onChange} label="Map: drag the pin onto the place" />
    </div>
  )
}
