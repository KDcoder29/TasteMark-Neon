// Finds the restaurant's name on a bill photo. The name is printed to stand out: bigger, bolder,
// centred, in capitals, on its own at the top. Lines come from the reader (lib/billOcr readBillText)
// with their box (x0 y0 x1 y1) and ink (share of dark pixels: bold print has thicker strokes).
// The reader can't tell italic, so a slanted name is found by its size, place and spacing instead.
// Returns the name, or null when no line stands out (better no name than a wrong one).
import { parseBillText } from '@/lib/billParse'

// words that mark a line as something else: the bill's title, tax ids, the table and the time,
// contacts, the address, the company behind the restaurant, column heads and totals
const NOT_NAME = /\b(tax|invoice|bill|receipt|memo|estimate|gst|gstin|cgst|sgst|fssai|cin|pan|date|time|table|tbl|kot|order|token|cashier|server|steward|waiter|guest|covers?|phone|ph|mob(ile)?|tel|e-?mail|www|http|thank(s| you)?|welcome|visit|address|road|rd|street|st|marg|nagar|near|nr|opp(osite)?|floor|shop|complex|society|sector|pin(code)?|pvt|private|ltd|limited|llp|original|duplicate|copy|qty|rate|amount|total|cash|card|upi)\b/i

const median = xs => { const s = xs.filter(x => x > 0).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0 }
const clamp = (x, hi) => Math.max(0, Math.min(hi, x))

// trademark signs and OCR specks off, spaces tidied
const tidy = t => t.replace(/[®™©|•*~_=]/g, ' ').replace(/^[^\p{L}]+|[^\p{L}'’.)]+$/gu, '').replace(/\s+/g, ' ').trim()

// could this line be a name at all?
function nameLike(text) {
  const t = tidy(text)
  const letters = (t.match(/\p{L}/gu) || []).length
  const digits = (t.match(/\d/g) || []).length
  const words = t.split(' ').filter(Boolean).length
  return letters >= 3 && digits <= 2 && words >= 1 && words <= 6 && t.length <= 40
    && letters / t.replace(/\s/g, '').length >= 0.6
    && (t.match(/,/g) || []).length < 2 && !NOT_NAME.test(t)
}

export function findRestaurantName(lines, { width } = {}) {
  if (!lines?.length) return null
  const geo = lines.every(l => l.y1 > l.y0)
  const h = l => l.y1 - l.y0
  const medH = geo ? median(lines.map(h)) : 1
  const medInk = median(lines.map(l => l.ink || 0))
  // the name is printed above the items: stop at the first dish line, and look at the top lines only
  const firstDish = lines.findIndex(l => parseBillText(l.text).length)
  const top = lines.slice(0, firstDish < 0 ? 8 : Math.min(firstDish, 8))

  const score = (l, i) => {
    const t = tidy(l.text)
    let s = i === 0 ? 0.6 : i < 3 ? 0.3 : 0                                  // near the top
    if (!/\p{Ll}/u.test(t)) s += 0.5                                          // ALL CAPS
    if (geo) {
      s += 2 * clamp(h(l) / medH - 1, 1.5)                                    // bigger font
      if (width && Math.abs((l.x0 + l.x1) / 2 - width / 2) / width < 0.12) s += 0.8   // centred
      const above = i ? l.y0 - lines[i - 1].y1 : l.y0, below = lines[i + 1] ? lines[i + 1].y0 - l.y1 : 0
      if (Math.max(above, below) > 0.8 * medH) s += 0.6                       // printed on its own
    }
    if (medInk && l.ink) s += 1.5 * clamp(l.ink / medInk - 1, 1)              // bold (thicker ink)
    return s
  }

  let best = -1, bestScore = 1    // below 1 nothing stands out
  top.forEach((l, i) => { if (nameLike(l.text)) { const s = score(l, i); if (s > bestScore) { best = i; bestScore = s } } })
  if (best < 0) return null

  // a name printed over two lines of the same size ("THE GRAND" / "BHAGWATI") is one name. Big print
  // has big gaps, so the gap is measured against the name's own line height, not the body text
  const same = j => top[j] && nameLike(top[j].text) && (!geo || (Math.abs(h(top[j]) / h(top[best]) - 1) < 0.15
    && Math.abs(j < best ? top[best].y0 - top[j].y1 : top[j].y0 - top[best].y1) < h(top[best])))
  const parts = [same(best - 1) && top[best - 1], top[best], same(best + 1) && top[best + 1]].filter(Boolean)
  let name = tidy(parts.map(l => tidy(l.text)).join(' '))
  if (name.split(' ').length > 6) name = tidy(top[best].text)
  // printed in capitals -> "The Grand Bhagwati"; anything else stays as printed ("McDonald's")
  return /\p{Ll}/u.test(name) ? name : name.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, s, c) => s + c.toUpperCase())
}
