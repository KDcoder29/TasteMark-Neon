import Icon from './Icons'
import { CRAWL_MIN, CRAWL_MAX } from './crawl'

// The food-crawl bar under the map: how many stops are picked, Plan, and once planned the best
// order with Open in Google Maps. If OSRM can't be reached the picks stay and Google still opens them in order.
// props: count, busy, trip ({ km, min } once planned), failed, approx (any stop is area-level),
//        url (Google Maps link, or null), note (short refusal text), onPlan, onClear
export default function CrawlBar({ count, busy = false, trip = null, failed = false, approx = false, url, note = '', onPlan, onClear }) {
  const mute = { color: 'var(--mute)' }
  const km = trip && (trip.km < 1 ? `${Math.round(trip.km * 1000)} m` : `${Math.round(trip.km * 10) / 10} km`)
  const maps = url && (
    <a className="btn btn-pri !px-3.5 !py-1.5 !text-sm" href={url} target="_blank" rel="noopener noreferrer"><Icon name="navigate" size={15} /> Open in Google Maps</a>
  )
  return (
    <div className="crawlbar fade" role="region" aria-label="Plan a route">
      <p className="m-0 text-[15px] font-bold">{count} {count === 1 ? 'stop' : 'stops'}
        <span className="ml-2 text-[12.5px] font-normal" style={mute}>{count < CRAWL_MIN ? `Pick ${CRAWL_MIN} to ${CRAWL_MAX} places` : `up to ${CRAWL_MAX}`}</span></p>
      {trip && <p className="m-0 mt-0.5 text-[14px] font-semibold" role="status">Best order · {approx ? '≈ ' : ''}{trip.min} min · {approx ? '≈ ' : ''}{km}</p>}
      {failed && <p className="m-0 mt-0.5 text-[13.5px]" style={{ color: 'var(--bad)' }} role="alert">Couldn’t plan the route right now. Your picks are kept{url ? '; you can still open them in this order.' : '.'}</p>}
      {note && <p className="m-0 mt-0.5 text-[13px]" style={mute} role="status">{note}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!trip && <button type="button" className="btn btn-pri !px-3.5 !py-1.5 !text-sm" onClick={onPlan} disabled={count < CRAWL_MIN || busy}
          title={count < CRAWL_MIN ? 'Pick at least 2 places' : undefined}>{busy ? 'Planning…' : failed ? 'Try again' : 'Plan'}</button>}
        {maps}
        <button type="button" className="btn !px-3.5 !py-1.5 !text-sm" onClick={onClear}>Clear</button>
      </div>
    </div>
  )
}
