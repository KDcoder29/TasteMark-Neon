// The "Craving?" chat's brain. Pure functions (the AI model's vectors are passed in), so all of
// the ranking is unit-tested. Every dish gets the strongest of three signals:
//   meaning — on-device AI model: how close the dish's text is to the question in meaning
//   family  — food dictionary (foodLexicon.js): "south indian" -> dosa, idli, …
//   words   — the journal's smart word search (search.js): typos, Gujarati/Hindi words
// then a small nudge for dishes you rated higher or said you'd order again.
import { matchScore, words as tokens } from './search'

// dictionary words must appear as WHOLE words (plurals ok: "dosas" = dosa). Fuzzy prefix matching
// made "vada" (South Indian) match "Vadapav" (Mumbai street food).
const phraseIn = (phrase, text) => ` ${tokens(text).join(' ')} `.includes(` ${tokens(phrase).join(' ')} `)
import { expandQuery, topicsOfDish } from './foodLexicon'

// Measured on the real journal: right matches score ~0.3–0.4 and noise up to ~0.37 (cheese puff vs
// "chilled"), so the model only counts when it is clearly sure; the dictionary leads otherwise.
const MEANING_MIN = 0.42
const FAMILY = 0.8         // a dictionary match is strong, but a close meaning match can beat it
const STOP = new Set(['i', 'want', 'to', 'eat', 'have', 'something', 'some', 'a', 'an', 'the', 'me', 'my', 'craving',
  'crave', 'feel', 'like', 'for', 'of', 'pls', 'please', 'any', 'suggest', 'options', 'food', 'good', 'get', 'where', 'can', 'today', 'tonight'])

// small, stable text hash (FNV-1a): a dish's cached vector is reused until its text changes
function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0).toString(36)
}

// journal -> one searchable entry per dish, with its place folded into the text
export function docsFromPlaces(places) {
  return (places || []).flatMap(place => (place.dishes || []).map(dish => {
    const where = [place.area, place.city].filter(v => v && /[a-z0-9]/i.test(v)).join(', ')
    // the small model knows English food words but not "kulfi" or "lassi": adding the dish's families
    // ("Desserts, Something cold") lifted the right matches a lot (measured: lassi vs "chilled" 0.06 -> 0.37)
    const families = topicsOfDish(`${dish.name} ${dish.note || ''}`).join(', ')
    const text = [dish.name, dish.note, families, `${place.name}${where ? ', ' + where : ''}`, (place.categories || []).join(' ')]
      .filter(Boolean).join('. ')
    return { key: hash(text), text, dish, place }
  }))
}

// "something cold under ₹150" -> { query: 'something cold', priceLimit: 150 }
export function parseCraving(text) {
  const m = String(text).match(/(?:under|below|less than|upto|up to|within)\s*(?:rs\.?|₹)?\s*(\d{2,5})\s*(?:rs\.?|₹|rupees)?/i)
  const query = String(text).replace(m ? m[0] : '', ' ').replace(/\s+/g, ' ').trim()
  return { query, priceLimit: m ? +m[1] : null }
}

export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

const words = q => q.toLowerCase().split(/[^a-z0-9]+/).filter(w => w && !STOP.has(w)).join(' ')

// qvec / vecs: the question's and each dish's vectors from the model (absent until it's ready)
export function rankDishes({ query, docs, qvec = null, vecs = null, priceLimit = null, limit = 8 }) {
  const q = words(query)
  const { terms } = expandQuery(query)
  const out = []
  for (const doc of docs) {
    const { dish } = doc
    if (priceLimit != null && !(dish.price != null && dish.price <= priceLimit)) continue
    const sem = qvec && vecs?.[doc.key] ? cosine(qvec, vecs[doc.key]) : 0
    const own = `${dish.name} ${dish.note || ''}`
    const signals = {
      meaning: sem >= MEANING_MIN ? sem : 0,
      family: terms.some(t => phraseIn(t, own)) ? FAMILY : 0,
      words: q ? matchScore(q, doc.text) : 0,
    }
    const [why, base] = Object.entries(signals).sort((a, b) => b[1] - a[1])[0]
    if (base <= 0) continue
    out.push({ doc, why, score: base + 0.04 * (dish.rating || 0) + (dish.order_again === 'yes' ? 0.08 : 0) })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}

// tappable follow-ups: the dishes found, then the other food families they belong to
export function relatedSearches(results, query) {
  const asked = new Set(expandQuery(query).topics)
  const q = query.trim().toLowerCase()
  const names = [...new Set(results.map(r => r.doc.dish.name))].filter(n => n.toLowerCase() !== q).slice(0, 3)
  const families = [...new Set(results.flatMap(r => topicsOfDish(r.doc.dish.name)))].filter(t => !asked.has(t))
  return [...names, ...families].slice(0, 5)
}
