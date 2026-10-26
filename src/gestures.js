// Touch maths for the phone gestures (swipe a sheet down to close it, pull Home down to refresh).
// Pure numbers only, so they can be tested; the hooks in useGestures.js do the touching.

// Let go of a sheet: close it when it was dragged far enough (a third of its height, at most
// 140px) or flicked down quickly. Tiny twitches never close it.
export function shouldDismiss({ dy, ms, height }) {
  if (dy < 24) return false
  if (dy >= Math.min(140, height / 3)) return true
  return dy / Math.max(ms, 1) > 0.5
}

// Pull to refresh: the indicator follows the finger with growing resistance and stops at 110px.
const PULL_MAX = 110
export const PULL_READY = 70
export const pullDistance = dy => (dy <= 0 ? 0 : Math.round(PULL_MAX * (1 - Math.exp(-dy / 150))))
