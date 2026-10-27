import Icon from './Icons'
import { FEATURES } from './features'
import { TOUR } from './tourPlan'
import { useSheetDrag } from './useGestures'
import { useEscape, useScrollLock } from './layers'

const tourSeconds = Math.round(TOUR.reduce((s, x) => s + x.ms, 0) / 1000)

// "How BiteMark works": always one tap away (? in the phone top bar, the You tab, the laptop
// sidebar). Plays the tour or the screen recording, and lists every feature with a Try it button.
export default function FeatureGuide({ onClose, onTour, onVideo, onTry }) {
  const drag = useSheetDrag(onClose)
  useEscape(onClose)
  useScrollLock()
  const mute = { color: 'var(--mute)' }

  return (
    <>
      <div className="scrim" onMouseDown={onClose} />
      <section ref={drag} className="drawer lg:!w-[480px]" role="dialog" aria-modal="true" aria-label="How BiteMark works">
        <div className="grabber" />
        <div className="flex items-center justify-between px-5 pb-2 pt-2 lg:pt-6">
          <h2 className="m-0 text-lg font-bold">How BiteMark works</h2>
          <button onClick={onClose} aria-label="Close" className="ghost grid h-9 w-9 place-items-center rounded-full" style={mute}><Icon name="x" size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8">
          <div className="guide-hero mb-5">
            <button className="guide-play tour-card" onClick={onTour}>
              <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: '#ffffff26' }}><Icon name="play" size={20} /></span>
              <span><b className="block text-[15px]">Play the tour</b><span className="text-xs" style={{ color: '#d6e8df' }}>{tourSeconds} seconds, every feature</span></span>
            </button>
            <button className="guide-play video-card" onClick={onVideo}>
              <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: 'var(--accent)', color: '#fff' }}><Icon name="film" size={20} /></span>
              <span><b className="block text-[15px]">Watch it in action</b><span className="text-xs" style={mute}>A screen recording of the app</span></span>
            </button>
          </div>

          {FEATURES.map(g => (
            <div key={g.title} className="mb-4">
              <h3 className="m-0 mb-1 text-[13px] font-bold" style={mute}>{g.title}</h3>
              {g.items.map(f => (
                <div key={f.title} className="guide-item">
                  <span className="qicon !h-9 !w-9" style={{ background: 'var(--pri-soft)', color: 'var(--pri)' }}><Icon name={f.icon} size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <b className="block text-[15px]">{f.title}</b>
                    <p className="m-0 mt-0.5 text-[13.5px] leading-snug" style={mute}>{f.text}</p>
                  </div>
                  {f.action && (
                    <button className="btn shrink-0 self-center !px-3 !py-1.5 !text-[13px]" onClick={() => onTry(f.action)}>Try it</button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
