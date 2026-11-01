// What a place card shows at a glance, worked out from its dishes.
// Works for personal dishes (rating) and group dishes (rating = the members' average).

export function placeSummary(place) {
  const dishes = place.dishes || []
  const rated = dishes.filter(d => d.rating > 0)
  const prices = dishes.map(d => d.price).filter(x => x > 0)
  const lo = Math.min(...prices), hi = Math.max(...prices)
  const byRating = (a, b) => (b.rating || 0) - (a.rating || 0)
  const again = dishes.filter(d => d.order_again === 'yes')
  // order-again dishes first (you said you'd have them again), otherwise the best one rated 4★+;
  // a 2★ dish is never "must try", even if it's the only one
  const best = [...again].sort(byRating)[0] || [...rated].filter(d => d.rating >= 4).sort(byRating)[0]
  return {
    avg: rated.length ? (rated.reduce((s, d) => s + d.rating, 0) / rated.length).toFixed(1) : null,
    price: !prices.length ? '' : lo === hi ? `₹${lo}` : `₹${lo}–${hi}`,
    dishCount: dishes.length,
    againCount: again.length,
    // shown on cards instead of an average: one great dish among six bad ones is still worth going for
    loved: dishes.filter(d => d.rating >= 4 || d.order_again === 'yes').length,
    mustTry: best?.name ?? null,
  }
}

// "Mujmahuda, Vadodara" — some places were saved with "-" as the area; those don't show
export const placeWhere = p => [p.area, p.city].map(v => (v || '').trim()).filter(v => /[\p{L}\p{N}]/u.test(v)).join(', ')
