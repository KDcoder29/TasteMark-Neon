// Area summaries for the map: what a group of places has in common (Alkapuri, or one cluster bubble).

// the display name of a place's area: the last comma or slash part ("Express Hotel, Alkapuri" -> "Alkapuri")
const areaName = p => String(p?.area || '').split(/[,/]/).pop().trim()

// the same, folded so spellings group together
export const areaKey = p => areaName(p).toLowerCase()

const rated = p => (p.dishes || []).filter(d => d.rating != null && !Number.isNaN(+d.rating))

// { name, count, avg, best }: the commonest area name, how many places, the mean of each place's
// best dish rating (1 decimal), and the top dish (ties: the most recent) with its place
export function areaSummary(items) {
  const names = new Map()
  for (const p of items) { const n = areaName(p); if (n) names.set(n, (names.get(n) || 0) + 1) }
  let name = ''
  let most = 0
  for (const [n, c] of names) if (c > most) { name = n; most = c }       // strict >, so ties keep the first

  const bests = []
  let best = null
  for (const p of items) {
    const ds = rated(p)
    if (!ds.length) continue
    bests.push(Math.max(...ds.map(d => +d.rating)))
    for (const d of ds) {
      const better = !best || +d.rating > best.rating || (+d.rating === best.rating && String(d.created_at || '') > best.at)
      if (better) best = { rating: +d.rating, at: String(d.created_at || ''), dish: d.name, place: p.name }
    }
  }
  const avg = bests.length ? Math.round((bests.reduce((a, b) => a + b, 0) / bests.length) * 10) / 10 : null
  return { name, count: items.length, avg, best: best && { dish: best.dish, place: best.place } }
}

// [lat, lng, weight] for the heatmap: more dishes, hotter (0.2 at least, 1 from 6 dishes); located places only
export const heatPoints = places => places
  .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  .map(p => [p.lat, p.lng, Math.min(1, Math.max(0.2, (p.dishes || []).length / 6))])

// { name, count }: the area you log most (first spelling seen; ties keep the first), needs 2+ places
export function foodHome(places) {
  const by = new Map()
  for (const p of places) {
    const k = areaKey(p)
    if (!k) continue
    const e = by.get(k)
    if (e) e.count++
    else by.set(k, { name: areaName(p), count: 1 })
  }
  let top = null
  for (const e of by.values()) if (!top || e.count > top.count) top = e
  return top && top.count >= 2 ? top : null
}

// group map: who added what. Options are [user id, label]; '' is everyone, you come first
export function addedByOptions(items, names = {}, me) {
  const ids = [...new Set(items.map(x => x.user_id).filter(Boolean))]
  const label = id => (id === me ? 'You' : names[id] || 'Someone')
  ids.sort((a, b) => (a === me ? -1 : b === me ? 1 : label(a).localeCompare(label(b))))
  return [['', 'Everyone'], ...ids.map(id => [id, label(id)])]
}
// the letter on a pin: the adder's first letter, "?" when we don't know them
export function adderInitial(id, names = {}, me) {
  const n = (names[id] || '').trim()
  if (n) return n[0].toUpperCase()
  return id && id === me ? 'Y' : '?'
}
