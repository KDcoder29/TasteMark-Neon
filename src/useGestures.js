// Phone gestures. Both move the elements directly (no React re-render per finger move) so they
// stay smooth with a long journal on screen. Laptops (mouse) never see them.
import { useEffect, useRef, useState } from 'react'
import { shouldDismiss, pullDistance, PULL_READY } from './gestures'

const phone = () => window.matchMedia?.('(max-width: 1023.98px)').matches ?? false

// a short tick on Android when something "lets go" (iPhones ignore it)
export const buzz = (ms = 8) => { try { navigator.vibrate?.(ms) } catch {} }

// Swipe a bottom sheet down to close it. Put the returned ref on the `.drawer`; the scrim just
// before it fades with the drag. Starts only when the content under the finger is scrolled to the
// top, so scrolling a long list still works.
export function useSheetDrag(onClose) {
  const ref = useRef(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const el = ref.current
    if (!el || !phone()) return
    const prev = el.previousElementSibling
    const scrim = prev?.classList.contains('scrim') ? prev : null
    let start = null, dy = 0, live = false

    const scrolled = t => { for (let n = t; n && n !== el; n = n.parentElement) if (n.scrollTop > 0) return true; return false }
    const down = e => {
      const t = e.target
      start = e.touches.length === 1 && !scrolled(t) && !t.closest('input[type=range], textarea, [data-nodrag]')
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() } : null
      dy = 0; live = false
    }
    const move = e => {
      if (!start) return
      const y = e.touches[0].clientY - start.y, x = e.touches[0].clientX - start.x
      if (!live) {
        if (y < -4 || Math.abs(x) > Math.max(8, y)) { start = null; return }   // a scroll up or a sideways swipe
        if (y < 8) return
        live = true
        for (const n of [el, scrim]) if (n) { n.style.animation = 'none'; n.style.transition = 'none' }
      }
      e.preventDefault()
      dy = Math.max(0, y)
      el.style.transform = `translateY(${dy}px)`
      if (scrim) scrim.style.opacity = String(1 - Math.min(1, dy / el.offsetHeight))
    }
    const up = () => {
      if (!start || !live) { start = null; return }
      const ms = performance.now() - start.t
      start = null; live = false
      el.style.transition = 'transform .22s var(--ease)'
      if (scrim) scrim.style.transition = 'opacity .22s'
      if (shouldDismiss({ dy, ms, height: el.offsetHeight })) {
        el.style.transform = 'translateY(100%)'
        if (scrim) scrim.style.opacity = '0'
        buzz()
        setTimeout(() => close.current(), 190)
      } else {
        el.style.transform = ''
        if (scrim) scrim.style.opacity = ''
      }
    }
    el.addEventListener('touchstart', down, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', up)
    el.addEventListener('touchcancel', up)
    return () => {
      el.removeEventListener('touchstart', down)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', up)
      el.removeEventListener('touchcancel', up)
    }
  }, [])
  return ref
}

// Pull the page down from the very top to refresh. `ball` is the round indicator element;
// returns true while refreshing. Off while a sheet or dialog is open.
export function usePullRefresh(ball, onRefresh, enabled = true) {
  const [busy, setBusy] = useState(false)
  const run = useRef(onRefresh)
  run.current = onRefresh

  useEffect(() => {
    const el = ball.current
    if (!el || !enabled || !phone()) return
    let start = null, dist = 0, live = false, locked = false
    const show = (d, ease) => {
      el.style.transition = ease ? 'transform .25s var(--ease), opacity .2s' : 'none'
      el.style.transform = `translateY(${d - 56}px)`
      el.style.opacity = String(Math.min(1, d / PULL_READY))
      el.firstChild.style.transform = `rotate(${d * 4}deg)`
      el.classList.toggle('ready', d >= PULL_READY)
    }

    const down = e => {
      start = !locked && e.touches.length === 1 && window.scrollY <= 0 && !document.querySelector('.scrim, [role=dialog]')
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null
      live = false; dist = 0
    }
    const move = e => {
      if (!start) return
      const y = e.touches[0].clientY - start.y, x = e.touches[0].clientX - start.x
      if (!live) {
        if (y < 0 || Math.abs(x) > Math.max(8, y)) { start = null; return }
        if (y < 6) return
        live = true
      }
      e.preventDefault()
      dist = pullDistance(y)
      show(dist)
    }
    const up = async () => {
      if (!start || !live) { start = null; return }
      start = null; live = false
      if (dist < PULL_READY) return show(0, true)
      locked = true
      buzz()
      show(64, true)
      el.classList.add('spin')
      setBusy(true)
      try { await run.current() } finally {
        el.classList.remove('spin')
        show(0, true)
        setBusy(false)
        locked = false
      }
    }
    window.addEventListener('touchstart', down, { passive: true })
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend', up)
    window.addEventListener('touchcancel', up)
    return () => {
      window.removeEventListener('touchstart', down)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', up)
      window.removeEventListener('touchcancel', up)
    }
  }, [enabled])
  return busy
}
