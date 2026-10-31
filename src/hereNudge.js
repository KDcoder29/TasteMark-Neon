// "Are you at …?": when you stand within 400 m of a place that only has an area-level (≈) position
// and your GPS is good (50 m or better), Near me offers your spot as its exact location.
// Dismissed offers are remembered on this device (localStorage). Nothing is sent anywhere.
import { distanceKm } from './geo'

export const NUDGE_REACH_M = 400
export const NUDGE_ACC_M = 50
const KEY = 'bm.nudge.no'

export const nudgeKey = x => `${x.kind === 'place' ? 'places' : 'wishlist'}:${x.id}`

export function nearbyGuess(items, me, dismissed) {
  if (!me || !(me.acc <= NUDGE_ACC_M)) return null
  let best = null, bestM = Infinity
  for (const x of items || []) {
    if (x.loc_source !== 'area' || x.lat == null || x.lng == null || dismissed?.has(nudgeKey(x))) continue
    const m = distanceKm(me, x) * 1000
    if (m <= NUDGE_REACH_M && m < bestM) { best = x; bestM = m }
  }
  return best
}

export function nudgeDismissed(s) {
  try { const v = JSON.parse(s?.getItem(KEY) || '[]'); return new Set(Array.isArray(v) ? v : []) } catch { return new Set() }
}

export function dismissNudge(s, key) {
  try { s?.setItem(KEY, JSON.stringify([...nudgeDismissed(s), key])) } catch {}
}
