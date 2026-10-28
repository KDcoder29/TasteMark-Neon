import { useEffect, useRef, useState } from 'react'

// One map component for the whole app: Leaflet (open source) + OpenStreetMap tiles. Free, no API
// key. Leaflet is only downloaded the first time a map is opened, so the app itself stays fast.
//
// center/zoom  where the map looks (changing them moves the map)
// markers      [{ id, lat, lng, kind: 'place' | 'wish' | 'me', color, title, approx }]; tapping one calls onMarker(id);
//              approx (area-level) pins are drawn hollow
// pin          the draggable pin { lat, lng } (forms / Fix locations); dragging it or tapping the map calls onPin
// fit          frame all markers instead of using center/zoom
let leafletLoad
const loadLeaflet = () => (leafletLoad ||= Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([m]) => m.default || m))

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const CREDIT = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
const BOOKMARK = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M6 4h12v17l-6-4-6 4z"/></svg>'

function icon(L, m, on) {
  if (m.kind === 'me') return L.divIcon({ className: '', html: '<span class="mk-me"></span>', iconSize: [22, 22], iconAnchor: [11, 11] })
  const inner = m.kind === 'wish' ? BOOKMARK : '<i></i>'
  return L.divIcon({
    className: '', iconSize: [30, 38], iconAnchor: [15, 36],
    html: `<span class="mk ${m.kind === 'wish' ? 'mk-wish' : ''} ${m.approx ? 'mk-approx' : ''} ${on ? 'on' : ''}" style="--c:${m.color || 'var(--pri)'}">${inner}</span>`,
  })
}

// still        a preview: no dragging or zooming (so it never traps the page's scroll)
export default function LeafletMap({ center, zoom = 15, markers = [], pin, onPin, onMarker, selected, fit = false, still = false, className = '', label = 'Map' }) {
  const el = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)
  const pinMarker = useRef(null)
  const lib = useRef(null)
  const cb = useRef({})
  cb.current = { onPin, onMarker }
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let dead = false
    let measure
    loadLeaflet().then(L => {
      if (dead || !el.current) return
      lib.current = L
      const fixed = still ? { dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false } : {}
      const m = L.map(el.current, { zoomControl: !still, ...fixed }).setView([center.lat, center.lng], zoom)
      L.tileLayer(TILES, { maxZoom: 19, attribution: CREDIT }).addTo(m)
      m.attributionControl.setPrefix(false)
      layer.current = L.layerGroup().addTo(m)
      m.on('click', e => cb.current.onPin?.({ lat: e.latlng.lat, lng: e.latlng.lng }))
      map.current = m
      setReady(true)
      measure = setTimeout(() => m.invalidateSize(), 60)    // sheets slide in: measure again once they're in place
    }).catch(err => { console.error(err); setFailed(true) })
    // stop any pan/zoom first: removing a map mid-animation crashes Leaflet (_leaflet_pos)
    return () => { dead = true; clearTimeout(measure); map.current?.stop(); map.current?.remove(); map.current = null }
  }, [])

  // move the map when the caller moves it (a search result, "you are here"); no animation, so a
  // map that closes right after can't be caught mid-move
  useEffect(() => {
    if (ready && !fit) map.current.setView([center.lat, center.lng], zoom, { animate: false })
  }, [ready, center.lat, center.lng, zoom])

  useEffect(() => {
    if (!ready) return
    const L = lib.current
    layer.current.clearLayers()
    for (const m of markers) {
      L.marker([m.lat, m.lng], { icon: icon(L, m, m.id === selected), title: m.title || '', keyboard: true, zIndexOffset: m.kind === 'me' ? -100 : m.id === selected ? 500 : 0 })
        .on('click', () => cb.current.onMarker?.(m.id))
        .addTo(layer.current)
    }
  }, [ready, markers, selected])

  // frame all pins when the set of pins changes (not when one is tapped)
  useEffect(() => {
    if (!ready || !fit || !markers.length) return
    map.current.fitBounds(lib.current.latLngBounds(markers.map(m => [m.lat, m.lng])), { padding: [36, 36], maxZoom: 16, animate: false })
  }, [ready, markers, fit])

  useEffect(() => {
    if (!ready) return
    const L = lib.current
    if (!pin) { pinMarker.current?.remove(); pinMarker.current = null; return }
    if (!pinMarker.current) {
      pinMarker.current = L.marker([pin.lat, pin.lng], {
        draggable: !still, keyboard: !still, title: still ? '' : 'Drag onto the exact place', zIndexOffset: 1000,
        icon: L.divIcon({ className: '', html: '<span class="mk mk-drag"><i></i></span>', iconSize: [36, 46], iconAnchor: [18, 44] }),
      }).on('dragend', e => { const ll = e.target.getLatLng(); cb.current.onPin?.({ lat: ll.lat, lng: ll.lng }) })
        .addTo(map.current)
    } else pinMarker.current.setLatLng([pin.lat, pin.lng])
  }, [ready, pin?.lat, pin?.lng])

  return (
    <div className={`lmap ${className}`} role="region" aria-label={label}>
      <div ref={el} className="absolute inset-0" />
      {!ready && !failed && <div className="lmap-msg"><span className="scanbar w-24" aria-hidden="true" /> Loading map…</div>}
      {failed && <div className="lmap-msg">The map couldn’t load. Check your connection.</div>}
    </div>
  )
}
