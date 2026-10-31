import { isLocated } from './geo'
import { areaKey, foodHome } from './mapInsights'

// "Replay your food year": the journal's located places that have a real added-date, oldest first
const dated = places => places
  .filter(p => isLocated(p) && p.created_at && !Number.isNaN(new Date(p.created_at).getTime()))
  .map(p => ({ p, t: new Date(p.created_at) }))
  .sort((a, b) => a.t - b.t)

const monthKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

// [{ key: '2026-03', label: 'Mar 2026', ids: [...everything so far], added }], one per month with new places
export function replayFrames(places) {
  const frames = []
  const ids = []
  for (const { p, t } of dated(places)) {
    const key = monthKey(t)
    ids.push(String(p.id))
    const last = frames[frames.length - 1]
    if (last && last.key === key) { last.ids = [...ids]; last.added++ }
    else frames.push({ key, label: t.toLocaleString('en', { month: 'short', year: 'numeric' }), ids: [...ids], added: 1 })
  }
  return frames
}

// the end card: places replayed, their dishes, distinct areas, and the area you log most
export function replaySummary(places) {
  const used = dated(places).map(x => x.p)
  return {
    places: used.length,
    dishes: used.reduce((n, p) => n + (p.dishes || []).length, 0),
    areas: new Set(used.map(areaKey).filter(Boolean)).size,
    home: foodHome(used),
  }
}
