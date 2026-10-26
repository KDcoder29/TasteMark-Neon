import Icon from './Icons'
import { placeSummary, placeWhere } from './placeView'

export const CAT_TINT = { Food: '#b8541a', Cafe: '#7a5236', Dessert: '#ad3f66', Healthy: '#2f7d5b' }
export const tileColor = p => CAT_TINT[(p.categories || [])[0]] || '#5f6b66'

// No average rating on purpose: one great dish among six bad ones would average out "low",
// yet that place is still worth going back to. So: how many dishes you loved (4★+ or order again).
export function LovedTag({ s, of = false }) {
  if (s.loved) return (
    <span className="lovetag" aria-label={`${s.loved} of ${s.dishCount} dishes loved`}>
      <Icon name="heart" size={13} stroke={2.4} />{of ? `${s.loved} of ${s.dishCount} loved` : `${s.loved} loved`}
    </span>
  )
  return s.avg == null && s.dishCount > 0 ? <span className="lovetag none">Not rated</span> : null
}

// One place in the journal grid. Dishes stay out of the card (that's what made the old list
// so long); the card says enough to choose, and a tap opens the full details.
// searching: the dishes left after the search filter are listed as the reason it matched.
export default function PlaceCard({ p, group, me, names, searching, index = 0, onOpen }) {
  const s = placeSummary({ dishes: p.allDishes || p.dishes })
  const where = placeWhere(p)
  const matches = searching ? (p.dishes || []).map(d => d.name) : []
  const mute = { color: 'var(--mute)' }

  return (
    <button type="button" onClick={onOpen} className="pcard rise" style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
      aria-label={`${p.name}${where ? ', ' + where : ''}`}>
      <span className="mono h-14 w-14 text-xl" style={{ background: tileColor(p) }}>{p.name.trim()[0]?.toUpperCase()}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="truncate text-[16px] font-bold leading-snug">{p.name}</span>
          <LovedTag s={s} />
        </span>
        <span className="mt-0.5 block truncate text-[13px]" style={mute}>
          {[where, (p.categories || []).join(' · ')].filter(Boolean).join(' · ')}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px]" style={mute}>
          {s.price && <span className="font-semibold" style={{ color: 'var(--ink)' }}>{s.price}</span>}
          <span>{s.dishCount} {s.dishCount === 1 ? 'dish' : 'dishes'}</span>
          {p.bill_photos?.length > 0 && <span className="inline-flex items-center gap-0.5"><Icon name="receipt" size={13} /> bill</span>}
          {group && <span className="truncate">· by {p.user_id === me ? 'you' : names[p.user_id] || 'a member'}</span>}
        </span>
        {matches.length > 0 ? (
          <span className="mt-1 block truncate text-[13px]"><span className="must">Matches:</span> {matches.join(', ')}</span>
        ) : s.mustTry && (
          <span className="mt-1 flex items-center gap-1 truncate text-[13px]">
            <Icon name="sparkle" size={13} className="shrink-0" style={{ color: 'var(--accent)' }} />
            <span className="must">Must try:</span><span className="truncate">{s.mustTry}</span>
          </span>
        )}
      </span>
    </button>
  )
}
