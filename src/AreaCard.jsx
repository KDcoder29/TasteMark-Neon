import Icon from './Icons'

// The summary of a tapped cluster bubble, under the map: "Alkapuri · 9 places · 4.3★ average · best: Masala dosa at Sankalp".
// Parts that are unknown are left out.
export function areaLine(s) {
  return [
    s.name,
    `${s.count} ${s.count === 1 ? 'place' : 'places'}`,
    s.avg != null ? `${s.avg}★ average` : null,
    s.best ? `best: ${s.best.dish} at ${s.best.place}` : null,
  ].filter(Boolean).join(' · ')
}

export default function AreaCard({ summary, onZoom, onShow, onClose }) {
  return (
    <section className="areacard" aria-label="Area summary">
      <p className="m-0 text-[15px] font-bold leading-snug">{areaLine(summary)}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <button type="button" className="btn btn-pri !px-3.5 !py-1.5 !text-sm" onClick={onZoom}>Zoom in</button>
        <button type="button" className="btn !px-3.5 !py-1.5 !text-sm" onClick={onShow}>Show these</button>
        <button type="button" className="ghost ml-auto grid h-8 w-8 place-items-center rounded-full" style={{ color: 'var(--mute)' }} onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
      </div>
    </section>
  )
}
