import { useEffect, useReducer, useRef } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icons'
import TourScene from './TourScenes'
import { TOUR, tourStart, tourStep } from './tourPlan'
import { useEscape, useScrollLock } from './layers'

// The 1-minute tour, played like stories: bars at the top, tap right / left to skip, hold to pause.
// onDone(next): next = 'add' (start the first entry), 'guide' (see all features) or undefined.
export default function Tour({ onDone }) {
  const [s, send] = useReducer(tourStep, undefined, tourStart)
  const scene = TOUR[s.i]
  const held = useRef(null)          // long-press timer: hold = pause, a quick tap = skip
  const lastScene = s.i === TOUR.length - 1

  useEscape(() => onDone())
  useEffect(() => { if (s.done) onDone() }, [s.done])
  useScrollLock()                                     // the page behind stays put

  // the clock: one requestAnimationFrame loop, paused while the tab is hidden
  useEffect(() => {
    let id, prev = performance.now()
    const loop = now => { send({ type: 'tick', ms: document.hidden ? 0 : Math.min(100, now - prev) }); prev = now; id = requestAnimationFrame(loop) }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const key = e => {
      if (e.key === 'ArrowRight') send({ type: 'next' })
      else if (e.key === 'ArrowLeft') send({ type: 'prev' })
      else if (e.key === ' ') { e.preventDefault(); send({ type: s.paused ? 'resume' : 'pause' }) }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [s.paused])

  // press: pause after 200 ms (a hold); release: resume, or if it was a quick tap, skip by side
  const down = () => { held.current = setTimeout(() => { held.current = 'held'; send({ type: 'pause' }) }, 200) }
  const up = side => {
    if (held.current === 'held') send({ type: 'resume' })
    else { clearTimeout(held.current); send({ type: side }) }
    held.current = null
  }
  const zone = side => ({
    onPointerDown: down, onPointerUp: () => up(side), onPointerCancel: () => { clearTimeout(held.current); held.current = null; send({ type: 'resume' }) },
  })

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-label="How BiteMark works">
      <div className="tour-top">
        <div className="tour-bars" aria-hidden="true">
          {TOUR.map((x, i) => (
            <button key={x.key} tabIndex={-1} onClick={() => send({ type: 'go', i })}>
              <span style={{ transform: `scaleX(${i < s.i ? 1 : i > s.i ? 0 : s.t / x.ms})` }} />
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between px-1 pt-3">
          <span className="text-[13px] font-semibold" style={{ color: '#ffffffb3' }}>{s.i + 1} of {TOUR.length}{s.paused ? ' · paused' : ''}</span>
          <span className="flex gap-1">
            <button className="tour-btn" onClick={() => send({ type: s.paused ? 'resume' : 'pause' })} aria-label={s.paused ? 'Play' : 'Pause'}>
              <Icon name={s.paused ? 'play' : 'pause'} size={18} />
            </button>
            <button className="tour-btn" onClick={() => onDone()} aria-label="Close the tour"><Icon name="x" size={20} /></button>
          </span>
        </div>
      </div>

      <div className="tour-body">
        <div className="tour-stage" key={scene.key}><TourScene k={scene.key} /></div>
        <div className="tour-caption" key={'c' + scene.key} aria-live="polite">
          <h2>{scene.title}</h2>
          <p>{scene.text}</p>
        </div>
        {/* tap zones over the picture: left third goes back, the rest goes forward */}
        <button className="tour-zone left" aria-label="Previous" {...zone('prev')} />
        <button className="tour-zone right" aria-label="Next" {...zone('next')} />
      </div>

      <div className="tour-foot">
        {lastScene ? (
          <>
            <button className="btn btn-accent w-full" onClick={() => onDone('add')}><Icon name="plus" size={18} stroke={2.6} /> Add my first place</button>
            <button className="tour-link" onClick={() => onDone('guide')}>See all features</button>
          </>
        ) : (
          <button className="tour-link" onClick={() => onDone()}>Skip the tour</button>
        )}
      </div>
    </div>,
    document.body,
  )
}
