// The journal's filtering and sorting, as plain functions: the list and the phone filter sheet's
// live "Show 12 places" count both run exactly this. (Moved out of Journal.jsx unchanged.)
import { matchScore } from './search'

export const SORTS = [['recent', 'Newest'], ['oldest', 'Oldest'], ['rating', 'Top rated'], ['cheap', 'Price: low to high'], ['pricey', 'Price: high to low'], ['name', 'A to Z']]

export const NO_FILTERS = { q: '', city: 'All', cat: 'All', minRate: 0, maxPrice: null, again: false }

// cap = top of the price slider: a max price at the top means "any price"
const priceOn = (f, cap) => f.maxPrice != null && f.maxPrice < cap

export function filterPlaces(places, f, cap = Infinity) {
  const searching = f.q.trim().length > 0
  const price = priceOn(f, cap)
  const dishFilter = f.minRate > 0 || price || f.again
  return places.flatMap(p => {
    if (f.city !== 'All' && p.city !== f.city) return []
    if (f.cat !== 'All' && !(p.categories || []).includes(f.cat)) return []
    const placeText = [p.name, p.city, p.area, (p.categories || []).join(' '), p.directions].join(' ')
    let best = 0
    const dishes = (p.dishes || []).filter(d => {
      if (f.minRate && !(d.rating >= f.minRate)) return false
      if (price && !(d.price != null && d.price <= f.maxPrice)) return false
      if (f.again && d.order_again !== 'yes') return false
      if (!searching) return true
      // smart match: every word must be found in the place or the dish (see search.js)
      const sc = matchScore(f.q, placeText, d.name, d.note)
      best = Math.max(best, sc)
      return sc > 0
    })
    if (dishFilter && !dishes.length) return []
    if (searching && !dishes.length) {
      // a place with no dishes yet, or whose dishes were all filtered out, can still match by its own details
      const ps = matchScore(f.q, placeText)
      if (!ps || (p.dishes || []).length) return []
      best = ps
    }
    return [{ ...p, dishes, allDishes: p.dishes, _score: best }]
  })
}

// sorting happens on the filtered list; places without a rating/price always go last
export function sortPlaces(results, sort, q) {
  const avg = (p, k) => {
    const v = (p.dishes || []).map(d => d[k]).filter(x => x != null && x > 0)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
  }
  const num = (k, dir) => (a, b) => {
    const x = avg(a, k), y = avg(b, k)
    if (x == null && y == null) return 0
    if (x == null) return 1
    if (y == null) return -1
    return dir * (x - y)
  }
  const by = {
    recent: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    oldest: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    rating: num('rating', -1),
    cheap: num('price', 1),
    pricey: num('price', -1),
    name: (a, b) => a.name.localeCompare(b.name),
  }[sort] || (() => 0)
  const out = [...results].sort(by)
  if (q.trim() && sort === 'recent') out.sort((x, y) => (y._score || 0) - (x._score || 0))   // best match first (stable, so ties stay newest-first)
  return out
}

// the number on the Filters button: filters that narrow the list (search and sort are shown elsewhere)
export const activeFilterCount = (f, cap) =>
  (f.city !== 'All') + (f.cat !== 'All') + (f.minRate > 0) + priceOn(f, cap) + !!f.again
