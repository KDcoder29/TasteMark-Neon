import { useEffect, useState } from 'react'
import Icon from './Icons'

// a number that counts up once when the You sheet opens (the sheet's one moment of motion)
function CountUp({ to }) {
  const [n, setN] = useState(() => (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? to : 0))
  useEffect(() => {
    if (n === to) return
    const t0 = performance.now(), from = n
    let id
    const tick = t => {
      const k = Math.min(1, (t - t0) / 650)
      setN(Math.round(from + (to - from) * (1 - (1 - k) ** 3)))
      if (k < 1) id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [to])
  return n
}

// "Your food story": the open journal in a few numbers (see foodStory.js)
export default function StoryCard({ story, space }) {
  if (!story?.places) return null
  const mute = { color: 'var(--mute)' }
  const rows = [
    story.topDish && ['heart', 'Favourite dish', <>{story.topDish.name} <span style={mute}>at {story.topDish.place}</span></>],
    story.favourite && ['sparkle', 'Your go-to food', story.favourite],
    story.againPct != null && ['repeat', 'Would order again', `${story.againPct}% of dishes`],
    story.topCity && story.cities > 1 && ['pin', 'Most visits', story.topCity],
  ].filter(Boolean)

  return (
    <section className="story" aria-label="Your food story">
      <p className="m-0 text-[13px] font-semibold" style={mute}>Your food story in {space}</p>
      <div className="story-nums">
        {[[story.places, 'places'], [story.dishes, 'dishes'], [story.cities, story.cities === 1 ? 'city' : 'cities']].map(([v, l]) => (
          <div key={l}><b><CountUp to={v} /></b><span>{l}</span></div>
        ))}
      </div>
      {rows.map(([icon, label, value], i) => (
        <div key={label} className="story-row rise" style={{ animationDelay: `${120 + i * 50}ms` }}>
          <span className="qicon !h-8 !w-8 !rounded-[10px]" style={{ background: 'var(--pri-soft)', color: 'var(--pri)' }}><Icon name={icon} size={16} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs" style={mute}>{label}</span>
            <span className="block truncate text-[14.5px] font-semibold">{value}</span>
          </span>
        </div>
      ))}
    </section>
  )
}
