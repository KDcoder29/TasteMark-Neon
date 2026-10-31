import { describe, expect, test } from 'vitest'
import { TOUR, tourStart, tourStep, shouldAutoTour, tourSeen, markTourSeen } from './tourPlan'
import { hasScene } from './TourScenes'

const store = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) } }
const len = TOUR.length

describe('the tour scenes', () => {
  test('about a minute long, every scene with a title, a sentence and a time', () => {
    const total = TOUR.reduce((s, x) => s + x.ms, 0)
    expect(total).toBeGreaterThan(45000)
    expect(total).toBeLessThan(80000)
    for (const s of TOUR) { expect(s.key && s.title && s.text).toBeTruthy(); expect(s.ms).toBeGreaterThan(3000) }
  })

  test('scene keys are unique', () => {
    expect(new Set(TOUR.map(s => s.key)).size).toBe(len)
  })

  test('Near me and maps have a scene (after Want to try): nearest first, on a map, exact spot from Google Maps', () => {
    const i = TOUR.findIndex(s => s.key === 'near')
    expect(i).toBe(TOUR.findIndex(s => s.key === 'wish') + 1)
    const t = (TOUR[i].title + ' ' + TOUR[i].text).toLowerCase()
    for (const w of ['near', 'map', 'google maps']) expect(t).toContain(w)
  })

  test('every scene has a picture', () => {
    for (const s of TOUR) expect(hasScene(s.key), s.key).toBe(true)
  })
})

describe('tourStep (plays like stories)', () => {
  test('time passes and moves on to the next scene by itself', () => {
    let s = tourStart()
    s = tourStep(s, { type: 'tick', ms: TOUR[0].ms - 1 })
    expect(s.i).toBe(0)
    s = tourStep(s, { type: 'tick', ms: 1 })
    expect(s).toMatchObject({ i: 1, t: 0 })
  })

  test('paused (finger held down) nothing moves', () => {
    let s = tourStep(tourStart(), { type: 'pause' })
    s = tourStep(s, { type: 'tick', ms: 99999 })
    expect(s).toMatchObject({ i: 0, t: 0 })
    s = tourStep(s, { type: 'resume' })
    expect(tourStep(s, { type: 'tick', ms: 500 }).t).toBe(500)
  })

  test('next / back by tap; back on the first scene restarts it', () => {
    let s = tourStep(tourStart(), { type: 'next' })
    expect(s.i).toBe(1)
    s = tourStep(tourStep(s, { type: 'tick', ms: 800 }), { type: 'prev' })
    expect(s).toMatchObject({ i: 0, t: 0 })
    s = tourStep(tourStep(s, { type: 'tick', ms: 800 }), { type: 'prev' })
    expect(s).toMatchObject({ i: 0, t: 0 })
  })

  test('the last scene waits for you (no auto-close), next then ends the tour', () => {
    let s = { ...tourStart(), i: len - 1 }
    s = tourStep(s, { type: 'tick', ms: 999999 })
    expect(s).toMatchObject({ i: len - 1, done: false })
    expect(s.t).toBe(TOUR[len - 1].ms)
    expect(tourStep(s, { type: 'next' }).done).toBe(true)
  })

  test('jump straight to a scene (progress bar tap)', () => {
    expect(tourStep(tourStart(), { type: 'go', i: 3 })).toMatchObject({ i: 3, t: 0 })
    expect(tourStep(tourStart(), { type: 'go', i: 99 }).i).toBe(len - 1)
  })
})

describe('who gets the tour automatically', () => {
  test('a brand-new account: empty journal and nothing to try, never seen it', () => {
    expect(shouldAutoTour({ ready: true, places: 0, wish: 0, seen: false })).toBe(true)
  })

  test('not while the journal is still loading (it might not be empty)', () => {
    expect(shouldAutoTour({ ready: false, places: 0, wish: 0, seen: false })).toBe(false)
  })

  test('not for people who already use the app, and only once', () => {
    expect(shouldAutoTour({ ready: true, places: 3, wish: 0, seen: false })).toBe(false)
    expect(shouldAutoTour({ ready: true, places: 0, wish: 2, seen: false })).toBe(false)
    expect(shouldAutoTour({ ready: true, places: 0, wish: 0, seen: true })).toBe(false)
  })

  test('"seen" is remembered per person on this device and survives log out', () => {
    const s = store()
    expect(tourSeen(s, 'u1')).toBe(false)
    markTourSeen(s, 'u1')
    expect(tourSeen(s, 'u1')).toBe(true)
    expect(tourSeen(s, 'u2')).toBe(false)
  })

  test('blocked storage never breaks it', () => {
    const bad = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(() => markTourSeen(bad, 'u1')).not.toThrow()
    expect(tourSeen(bad, 'u1')).toBe(false)
  })
})
