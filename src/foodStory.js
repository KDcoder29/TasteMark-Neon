// "Your food story": a few honest numbers about the open journal, shown in the You sheet.
import { topicsOfDish } from './foodLexicon'

const key = s => (s || '').trim().toLowerCase()
// moods and meal times from the dictionary: true, but not "a kind of food" you eat most
const BROAD = new Set(['Something cold', 'Spicy', 'Drinks', 'Snacks', 'Breakfast'])

export function foodStory(places) {
  const dishes = places.flatMap(p => (p.dishes || []).map(d => ({ ...d, place: p.name })))

  const cityCount = new Map()                                // lower-case city -> { name, n }
  for (const p of places) {
    const k = key(p.city)
    if (!k) continue
    const c = cityCount.get(k) || { name: p.city.trim(), n: 0 }
    c.n += 1
    cityCount.set(k, c)
  }
  let topCity = null
  for (const c of cityCount.values()) if (!topCity || c.n > topCity.n) topCity = c

  // best rated dish (4★ or more); order-again, then the newer one, breaks a tie
  const score = d => (d.rating || 0) * 10 + (d.order_again === 'yes' ? 1 : 0)
  let top = null
  for (const d of dishes) {
    if ((d.rating || 0) < 4) continue
    if (!top || score(d) > score(top) || (score(d) === score(top) && new Date(d.created_at) > new Date(top.created_at))) top = d
  }

  // the kind of food that shows up most (needs at least two dishes); dictionary order breaks a tie
  const topics = new Map()
  for (const d of dishes) for (const t of topicsOfDish(d.name)) if (!BROAD.has(t)) topics.set(t, (topics.get(t) || 0) + 1)
  let favourite = null, best = 1
  for (const [t, n] of topics) if (n > best) { favourite = t; best = n }

  const rated = dishes.filter(d => d.rating > 0)
  const again = rated.filter(d => d.order_again === 'yes').length

  return {
    places: places.length,
    dishes: dishes.length,
    cities: cityCount.size,
    topDish: top ? { name: top.name, place: top.place, rating: Math.round(top.rating) } : null,
    favourite,
    againPct: rated.length ? Math.round((again / rated.length) * 100) : null,
    topCity: topCity?.name ?? null,
  }
}
