import { useEffect, useRef, useState } from 'react'
import { tileSource, OSM_FALLBACK, CARTO_FREE } from './tiles'
import { boundsKey, APPROX_HALO_M, showHalo, labelLevel, escapeHtml } from './geo'

// One map component for the whole app: Leaflet (open source) + OpenStreetMap tiles (CARTO is off: CARTO_FREE = false, it needs an API key). Free, no API
// key. Leaflet is only downloaded the first time a map is opened, so the app itself stays fast.
//
// center/zoom  where the map looks (changing them moves the map)
// markers      [{ id, lat, lng, kind: 'place' | 'wish' | 'me', color, title, approx, num }]; tapping one calls onMarker(id);
//              approx (area-level) pins are drawn hollow
// pin          the draggable pin { lat, lng } (forms / Fix locations); dragging it or tapping the map calls onPin
// frameRoute   zoom to the route line when it appears (the crawl plan; a single tapped route doesn't)
// markers may carry initial (group space: who added it): a small letter badge on the pin, hidden on numbered crawl pins
// markers may carry num (a food-crawl stop): the pin shows that number
// fit          frame all markers instead of using center/zoom
// cluster      crowded pins merge into count bubbles; tapping one calls onCluster(ids, zoomIn) instead of zooming
//              (zoomIn() zooms to that bubble's pins). Your dot and the selected pin never join a bubble
// circle       { lat, lng, km }: a distance ring around you (Near me's 1 / 3 / 5 / 10 km); fit then frames the ring
// heat         [[lat, lng, weight], ...] draws a warm glow under the pins (not clickable); null removes it
// onView       called with { south, west, north, east } when the map stops moving (and once after the first fit);
//              it only reports, it never moves the map
// frameOn      markers to frame instead of `markers` (the replay shows few pins but keeps the full-set frame, so it never zooms per frame)
// children     drawn over the map (the replay's month label and controls)
let leafletLoad
// the cluster plugin hangs itself on a global L, so it loads here (lazy, with Leaflet), never in the main bundle
const loadLeaflet = () => (leafletLoad ||= Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(async ([m]) => {
  const L = m.default || m
  window.L = L
  await Promise.all([import('leaflet.markercluster'), import('leaflet.markercluster/dist/MarkerCluster.css'), import('leaflet.heat')])
  return L
}))

// after a few failed CARTO tiles every map uses OpenStreetMap for the rest of the session
let useOsm = !CARTO_FREE
const isDark = () => document.documentElement.dataset.theme === 'dark'
const BOOKMARK = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M6 4h12v17l-6-4-6 4z"/></svg>'

function icon(L, m, on) {
  if (m.kind === 'me') return L.divIcon({ className: 'mk-keep', html: '<span class="mk-me"></span>', iconSize: [22, 22], iconAnchor: [11, 11] })
  const inner = m.num ? `<b class="mk-num">${+m.num}</b>` : m.kind === 'wish' ? BOOKMARK : '<i></i>'
  return L.divIcon({
    className: on || m.num ? 'mk-keep' : '', iconSize: [30, 38], iconAnchor: [15, 36],
    // labels sit beside the (rotated) pin, not inside it, so they read upright; CSS shows them by zoom
    html: `<span class="mkw ${on ? 'on' : ''}"><span class="mk ${m.kind === 'wish' ? 'mk-wish' : ''} ${m.approx ? 'mk-approx' : ''} ${m.num ? 'mk-numbered' : ''} ${on ? 'on' : ''}" style="--c:${m.color || 'var(--pri)'}">${inner}</span>${m.initial && !m.num ? `<b class="mk-who">${escapeHtml(m.initial)}</b>` : ""}`
      + (m.label ? `<b class="mk-name">${escapeHtml(m.label)}</b>` : '') + (m.sub ? `<small class="mk-sub">${escapeHtml(m.sub)}</small>` : '') + '</span>',
  })
}

// still        a preview: no dragging or zooming (so it never traps the page's scroll)
export default function LeafletMap({ center, zoom = 15, markers = [], pin, onPin, onMarker, onCluster, onView, selected, fit = false, cluster = false, circle = null, route = null, heat = null, frameRoute = false, frameOn = null, children = null, still = false, className = '', label = 'Map' }) {
  const el = useRef(null)
  const map = useRef(null)
  const layer = useRef(null)
  const bubbles = useRef(null)
  const halos = useRef(null)
  const pinMarker = useRef(null)
  const ring = useRef(null)
  const routeLine = useRef(null)
  const heatLayer = useRef(null)
  const lib = useRef(null)
  const cb = useRef({})
  cb.current = { onPin, onMarker, onCluster, onView }
  const view = () => { const b = map.current?.getBounds(); return b && { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() } }
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [osmDark, setOsmDark] = useState(false)    // OSM tiles in dark mode: dim them with CSS, they have no dark style

  useEffect(() => {
    let dead = false
    let measure, themeWatch, sizeWatch
    loadLeaflet().then(L => {
      if (dead || !el.current) return
      lib.current = L
      const fixed = still ? { dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false } : {}
      const m = L.map(el.current, { zoomControl: !still, ...fixed }).setView([center.lat, center.lng], zoom)
      // CARTO light / dark, swapped live when the app theme changes; 4 tile errors switch to OSM for the session
      let tiles, errors = 0
      const setTiles = () => {
        const t = useOsm ? OSM_FALLBACK : tileSource(isDark())
        tiles?.remove()
        tiles = L.tileLayer(t.url, { maxZoom: 19, attribution: t.attribution, subdomains: t.subdomains }).addTo(m)
        setOsmDark(useOsm && isDark())
        if (!useOsm) tiles.on('tileerror', () => { if (++errors >= 4 && !useOsm) { useOsm = true; setTiles() } })
      }
      setTiles()
      themeWatch = new MutationObserver(setTiles)
      themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
      // the container can change size (full screen, sheets sliding in): re-measure
      sizeWatch = new ResizeObserver(() => m.invalidateSize())
      sizeWatch.observe(el.current)
      m.attributionControl.setPrefix(false)
      layer.current = L.layerGroup().addTo(m)
      if (cluster) {
        bubbles.current = L.markerClusterGroup({
          showCoverageOnHover: false, maxClusterRadius: 50, zoomToBoundsOnClick: false,
          iconCreateFunction: c => L.divIcon({ className: '', html: `<span class="mk-cluster">${c.getChildCount()}</span>`, iconSize: [40, 40] }),
        }).on('clusterclick', e => {
          const c = e.layer
          const ids = c.getAllChildMarkers().map(k => k.options.mkId)
          // zooming can't pull pins apart at the top zoom or when they share one point: fan them out instead
          const stuck = () => m.getZoom() >= m.getMaxZoom() || c.getBounds().getNorthEast().equals(c.getBounds().getSouthWest())
          const zoomIn = () => (stuck() ? c.spiderfy() : c.zoomToBounds({ padding: [40, 40] }))
          if (stuck()) c.spiderfy()
          cb.current.onCluster?.(ids, zoomIn)
        }).addTo(m)
      }
      halos.current = L.layerGroup()
      const sync = () => {
        if (showHalo(m.getZoom())) halos.current.addTo(m); else halos.current.remove()
        const lv = labelLevel(m.getZoom())
        m.getContainer().classList.toggle('lbl-1', lv === 1)
        m.getContainer().classList.toggle('lbl-2', lv === 2)
      }
      m.on('zoomend', sync)
      m.on('moveend', () => cb.current.onView?.(view()))
      sync()
      m.on('click', e => cb.current.onPin?.({ lat: e.latlng.lat, lng: e.latlng.lng }))
      map.current = m
      if (!fit) cb.current.onView?.(view())
      setReady(true)
      measure = setTimeout(() => m.invalidateSize(), 60)    // sheets slide in: measure again once they're in place
    }).catch(err => { console.error(err); setFailed(true) })
    // stop any pan/zoom first: removing a map mid-animation crashes Leaflet (_leaflet_pos)
    return () => { dead = true; clearTimeout(measure); themeWatch?.disconnect(); sizeWatch?.disconnect(); map.current?.stop(); map.current?.remove(); map.current = null }
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
    bubbles.current?.clearLayers()
    halos.current.clearLayers()
    for (const m of markers) {
      if (m.approx) L.circle([m.lat, m.lng], { radius: APPROX_HALO_M, className: 'lmap-halo', interactive: false }).addTo(halos.current)
      const home = bubbles.current && m.kind !== 'me' && m.id !== selected && !m.num ? bubbles.current : layer.current
      L.marker([m.lat, m.lng], { mkId: m.id, icon: icon(L, m, m.id === selected), title: m.title || '', keyboard: true, zIndexOffset: m.kind === 'me' ? -100 : m.id === selected ? 500 : 0 })
        .on('click', () => cb.current.onMarker?.(m.id))
        .addTo(home)
    }
  }, [ready, markers, selected])

  useEffect(() => {
    if (!ready) return
    ring.current?.remove(); ring.current = null
    if (circle) ring.current = lib.current.circle([circle.lat, circle.lng], { radius: circle.km * 1000, className: 'lmap-ring', interactive: false }).addTo(map.current)
  }, [ready, circle?.lat, circle?.lng, circle?.km])

  // the food heatmap: one layer, rebuilt when the points change (it sits in the overlay pane, under the pins; a bit stronger on dark tiles)
  useEffect(() => {
    if (!ready) return
    heatLayer.current?.remove(); heatLayer.current = null
    if (heat?.length) heatLayer.current = lib.current.heatLayer(heat, { radius: 28, blur: 22, minOpacity: document.documentElement.dataset.theme === 'dark' ? .4 : .25, gradient: { 0.3: '#f5c26b', 0.6: '#f26b1d', 1: '#b8541a' } }).addTo(map.current)
  }, [ready, heat])

  // the road route to the tapped place; its own layer, never part of framing
  useEffect(() => {
    if (!ready) return
    routeLine.current?.remove(); routeLine.current = null
    if (route?.length > 1) routeLine.current = lib.current.polyline(route, { className: 'lmap-route', interactive: false }).addTo(map.current)
    if (frameRoute && routeLine.current) map.current.fitBounds(routeLine.current.getBounds(), { padding: [36, 36], maxZoom: 16, animate: false })
  }, [ready, route])

  // frame all pins (or the distance ring) when they change, not when a pin is tapped
  const frameSet = frameOn || markers
  const framed = boundsKey(frameSet, circle)
  useEffect(() => {
    if (!ready || !fit) return
    const L = lib.current
    const box = circle ? L.latLng(circle.lat, circle.lng).toBounds(circle.km * 2000)
      : frameSet.length ? L.latLngBounds(frameSet.map(m => [m.lat, m.lng])) : null
    if (box) map.current.fitBounds(box, { padding: circle ? [12, 12] : [36, 36], maxZoom: 16, animate: false })
    cb.current.onView?.(view())
  }, [ready, framed, fit])

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
    <div className={`lmap ${osmDark ? 'osm-dark' : ''} ${className}`} role="region" aria-label={label}>
      <div ref={el} className="absolute inset-0" />
      {!ready && !failed && <div className="lmap-msg"><span className="scanbar w-24" aria-hidden="true" /> Loading map…</div>}
      {failed && <div className="lmap-msg">The map couldn’t load. Check your connection.</div>}
      {children}
    </div>
  )
}
