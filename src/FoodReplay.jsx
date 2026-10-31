import { useEffect } from 'react'
import Icon from './Icons'

// "Replay your food year": the overlay on the map while it plays (month, +added, counter, Pause, Skip)
// and the summary card at the end. The parent owns the timer and the frame; this only draws.
// props: frame ({ label, added }), total (places so far), playing, summary ({ places, dishes, areas, home }) once finished,
//        onToggle, onSkip, onClose
export default function FoodReplay({ frame, total, playing, summary = null, onToggle, onSkip, onClose }) {
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  if (summary) return (
    <div className="replay replay-end fade" role="dialog" aria-label="Your food year">
      <p className="m-0 text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--pri)' }}>Your food year</p>
      <div className="replay-stats">
        <span><b>{summary.places}</b> {summary.places === 1 ? 'place' : 'places'}</span>
        <span><b>{summary.dishes}</b> {summary.dishes === 1 ? 'dish' : 'dishes'}</span>
        <span><b>{summary.areas}</b> {summary.areas === 1 ? 'area' : 'areas'}</span>
      </div>
      {summary.home && <p className="m-0 mt-1.5 text-[13.5px] font-semibold">Your food home: {summary.home.name} ({summary.home.count} places)</p>}
      <button type="button" className="btn btn-pri mt-2.5 !px-4 !py-1.5 !text-sm" onClick={onClose} autoFocus>Close</button>
    </div>
  )
  return (
    <div className="replay fade" role="status" aria-label="Replaying your food year">
      <div className="flex items-center gap-2">
        <span className="replay-month" aria-live="polite">{frame.label}</span>
        <span className="replay-add" key={frame.label}>+{frame.added}</span>
        <span className="ml-auto text-[13px] font-semibold" style={{ color: 'var(--mute)' }}>{total} {total === 1 ? 'place' : 'places'}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" className="btn !px-3.5 !py-1.5 !text-sm" onClick={onToggle}>
          <Icon name={playing ? 'pause' : 'play'} size={15} /> {playing ? 'Pause' : 'Resume'}
        </button>
        <button type="button" className="btn !px-3.5 !py-1.5 !text-sm" onClick={onSkip}>Skip</button>
        <button type="button" className="ghost ml-auto grid h-8 w-8 place-items-center rounded-full" style={{ color: 'var(--mute)' }} onClick={onClose} aria-label="Close the replay"><Icon name="x" size={16} /></button>
      </div>
    </div>
  )
}
