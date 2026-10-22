// Turns a chat-style craving ("protein chips / bar", "something spicy under 100")
// into matches against the dishes already logged in BiteMark.
import { matchScore } from './search'

const STOP = new Set(['i', 'want', 'to', 'eat', 'have', 'something', 'some', 'a', 'an', 'the',
  'me', 'my', 'craving', 'crave', 'feel', 'like', 'for', 'of', 'pls', 'please', 'any', 'suggest', 'options'])

// "protein chips / bar, or pizza" -> ["protein chips", "bar", "pizza"]
// each clause's words must ALL match (it's one craving); clauses are OR'd (any craving will do)
function clauses(text) {
  return text
    .replace(/under\s*(?:rs\.?|₹)?\s*\d+/gi, ' ')          // price words pulled out separately
    .replace(/below\s*(?:rs\.?|₹)?\s*\d+/gi, ' ')
    .replace(/less\s+than\s*(?:rs\.?|₹)?\s*\d+/gi, ' ')
    .split(/[,/]| or | and |\n/i)
    .map(c => c.trim().toLowerCase().split(/\s+/).filter(w => w && !STOP.has(w)).join(' '))
    .filter(Boolean)
}

function priceLimit(text) {
  const m = text.match(/(?:under|below|less than)\s*(?:rs\.?|₹)?\s*(\d{2,5})/i)
  return m ? +m[1] : null
}

// one craving chat message -> { priceLimit, groups: [{ term, hits: [{place, dish, score}] }] }
export function cravingAnswer(text, places) {
  const limit = priceLimit(text)
  const terms = clauses(text)
  if (!terms.length) return { priceLimit: limit, groups: [] }

  const groups = terms.map(term => {
    const hits = []
    for (const p of places || []) {
      const placeText = [p.name, p.city, p.area, (p.categories || []).join(' ')].join(' ')
      for (const d of p.dishes || []) {
        if (limit != null && !(d.price != null && d.price <= limit)) continue
        const score = matchScore(term, placeText, d.name, d.note)
        if (score > 0) hits.push({ place: p, dish: d, score })
      }
    }
    hits.sort((a, b) =>
      b.score - a.score ||
      (b.dish.order_again === 'yes') - (a.dish.order_again === 'yes') ||
      (b.dish.rating || 0) - (a.dish.rating || 0))
    return { term, hits: hits.slice(0, 6) }
  })

  return { priceLimit: limit, groups }
}
