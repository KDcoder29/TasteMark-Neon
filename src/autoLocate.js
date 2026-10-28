import { supabase } from './supabase'
import { areaSpot } from './geocode'

// Automatic, area-level positions (from the landmark and city) for places saved without an exact
// spot. Runs in the background, one lookup at a time about a second apart (fair use of the free
// OpenStreetMap search), and only writes where there's no position or just an area-level one, so an
// exact spot (GPS, Google Maps link, pin) is never overwritten. Each place is tried once per app start.
// When some got a position, 'bm:located' is sent so the journal reloads. Something you just saved
// that couldn't be placed sends 'bm:notlocated' ({ table, id, name }) so you can be told.
const GAP = 1000
const queue = []
const tried = new Set()
let running = false

// items: [{ table: 'places' | 'wishlist', id, area, city }]. now: something you just saved, so it
// goes first (ahead of older places still being filled in) and is tried again even if tried before.
export function autoLocate(items, { now = false } = {}) {
  for (const it of items) {
    const key = `${it.table}:${it.id}`
    if (!it.id || (tried.has(key) && !now)) continue
    tried.add(key)
    if (now) queue.unshift({ ...it, now }); else queue.push(it)
  }
  run()
}

async function run() {
  if (running) return
  running = true
  let found = 0
  while (queue.length) {
    const it = queue.shift()
    const spot = await areaSpot(it)
    if (!spot && it.now) window.dispatchEvent(new CustomEvent('bm:notlocated', { detail: { table: it.table, id: it.id, name: it.name } }))
    if (spot) {
      const { error } = await supabase.from(it.table).update(spot).eq('id', it.id).or('loc_source.is.null,loc_source.eq.area')
      if (!error && ++found % 5 === 0) window.dispatchEvent(new Event('bm:located'))   // the map fills as it goes
      if (error) console.warn('Area position not saved', it.table, it.id, error.message)
    }
    if (queue.length) await new Promise(r => setTimeout(r, GAP))
  }
  running = false
  if (found % 5) window.dispatchEvent(new Event('bm:located'))
}
