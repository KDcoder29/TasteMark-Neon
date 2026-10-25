import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { distanceKm } from './geocode'

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Highest-rated dish decides the pin color: a proper favorite, an average place, or
// one you haven't rated anything at yet. "to try" (wishlist) items get their own color.
function placeKind(p) {
  const ratings = (p.dishes || []).map(d => d.rating).filter(n => n > 0)
  if (!ratings.length) return 'new'
  return Math.max(...ratings) >= 4 ? 'favorite' : 'average'
}

const KIND = {
  favorite: { color: 'var(--ok)', label: 'Favorite (4★+)' },
  average: { color: 'var(--pri)', label: 'Average' },
  new: { color: 'var(--mute)', label: 'No ratings yet' },
  wish: { color: 'var(--star)', label: 'Want to try' },
}

function dotIcon(color, big) {
  const size = big ? 18 : 14
  return L.divIcon({
    className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid var(--surface);box-shadow:0 1px 4px #0f172a4d"></span>`,
  })
}

function popupHtml(kind, p, gmaps) {
  const topDishes = [...(p.dishes || [])].filter(d => d.rating > 0).sort((a, b) => b.rating - a.rating).slice(0, 3)
  const addr = [p.area, p.city].filter(Boolean).join(', ')
  return `
    <div style="font-family:inherit;min-width:180px">
      <div style="font-weight:700;font-size:14px;margin-bottom:2px">${esc(p.name)}</div>
      ${addr ? `<div style="font-size:12px;color:var(--mute);margin-bottom:4px">📍 ${esc(addr)}</div>` : ''}
      ${kind === 'wish' && p.note ? `<div style="font-size:12px;margin-bottom:4px">${esc(p.note)}</div>` : ''}
      ${topDishes.length ? `<ul style="margin:4px 0 6px;padding:0;list-style:none;font-size:12px">
        ${topDishes.map(d => `<li style="display:flex;justify-content:space-between;gap:10px;padding:2px 0">
          <span>${esc(d.name)}</span><span style="color:var(--mute);white-space:nowrap">${'★'.repeat(d.rating)}${d.price ? ' · ₹' + d.price : ''}</span>
        </li>`).join('')}</ul>` : ''}
      <a href="${gmaps}" target="_blank" rel="noopener" style="font-size:12px;font-weight:600;color:var(--pri)">Open in Google Maps →</a>
    </div>`
}

// places/wishlist: already filtered to what Journal's search/city/category/rating/price
// filters currently show, so the map always matches the list above it.
export default function MapView({ places, wishlist }) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const meLayerRef = useRef(null)
  const [near, setNear] = useState(null)      // { lat, lng } once "Near me" is used
  const [locating, setLocating] = useState(false)
  const [locateErr, setLocateErr] = useState('')

  const pinned = places.filter(p => p.lat != null && p.lng != null)
  const wishPinned = wishlist.filter(w => w.lat != null && w.lng != null)
  const unplaced = (places.length - pinned.length) + (wishlist.length - wishPinned.length)

  // map + tile layer, created once. Plain OpenStreetMap tiles: the only raster basemap left
  // that's truly free with no API key (CARTO's free basemaps now require one — that's the
  // "API KEY REQUIRED" watermark you saw). OSM's own tiles don't have a dark variant, so the
  // map stays light-styled even in dark mode; everything else in the app still follows the toggle.
  useEffect(() => {
    const map = L.map(elRef.current, { zoomControl: true }).setView([22.3, 72.6], 6)   // Gujarat-ish default
    mapRef.current = map
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    return () => map.remove()
  }, [])

  // markers, rebuilt whenever the (already-filtered) lists change
  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current
    layer.clearLayers()
    const pts = []

    for (const p of pinned) {
      const kind = placeKind(p)
      const gmaps = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
      L.marker([p.lat, p.lng], { icon: dotIcon(KIND[kind].color) })
        .bindPopup(popupHtml(kind, p, gmaps))
        .addTo(layer)
      pts.push([p.lat, p.lng])
    }
    for (const w of wishPinned) {
      const gmaps = `https://www.google.com/maps/search/?api=1&query=${w.lat},${w.lng}`
      L.marker([w.lat, w.lng], { icon: dotIcon(KIND.wish.color) })
        .bindPopup(popupHtml('wish', w, gmaps))
        .addTo(layer)
      pts.push([w.lat, w.lng])
    }

    if (pts.length === 1) map.setView(pts[0], 14)
    else if (pts.length > 1) map.fitBounds(pts, { padding: [28, 28], maxZoom: 15 })
  }, [pinned, wishPinned])

  // "Near me": drop a marker at your location and re-center (uses the browser's own
  // geolocation, nothing external, nothing paid)
  useEffect(() => {
    const map = mapRef.current
    if (!meLayerRef.current) meLayerRef.current = L.layerGroup().addTo(map)
    meLayerRef.current.clearLayers()
    if (near) {
      L.marker([near.lat, near.lng], { icon: dotIcon('#2563eb', true) }).bindPopup('You are here').addTo(meLayerRef.current)
      map.setView([near.lat, near.lng], 13)
    }
  }, [near])

  function locate() {
    if (!navigator.geolocation) return setLocateErr("Your browser won't share location.")
    setLocating(true); setLocateErr('')
    navigator.geolocation.getCurrentPosition(
      pos => { setNear({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false) },
      () => { setLocateErr('Could not get your location — check the browser permission.'); setLocating(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const nearest = near
    ? [...pinned].map(p => ({ p, km: distanceKm(near, { lat: p.lat, lng: p.lng }) })).sort((a, b) => a.km - b.km).slice(0, 5)
    : []

  const mute = { color: 'var(--mute)' }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs" style={mute}>
        {Object.entries(KIND).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: v.color }} />{v.label}
          </span>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <button onClick={locate} disabled={locating} className="chip !py-1">
          {locating ? 'Locating…' : '📍 Near me'}
        </button>
        {pinned.length + wishPinned.length === 0 && (
          <span className="text-xs" style={mute}>No places on the map yet</span>
        )}
      </div>
      {locateErr && <p className="mb-2 text-xs" style={{ color: 'var(--bad)' }}>{locateErr}</p>}

      <div ref={elRef} className="h-[60vh] w-full overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--line)' }} />

      {unplaced > 0 && (
        <p className="mt-2 text-xs" style={mute}>
          {unplaced} {unplaced === 1 ? 'entry doesn’t' : 'entries don’t'} have a clear enough area/city to place on the map yet —
          edit one and re-save to try again.
        </p>
      )}

      {near && nearest.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">Nearest to you</h3>
          <div className="space-y-1.5">
            {nearest.map(({ p, km }) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
                <span className="truncate font-medium">{p.name}</span>
                <span className="shrink-0 text-xs" style={mute}>{km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1) + ' km'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
