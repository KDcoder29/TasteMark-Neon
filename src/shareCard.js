// "Send to friends": what goes on the shareable picture and in the WhatsApp caption.
// Pure helpers (tested); shareImage.js draws the picture with them.
import { placeWhere } from './placeView'
import { mapsUrl } from './mapsLink'

// a dish's stars: your rating in Personal, the group's average in a group
const starsOf = d => (d.nRatings != null || d.avg != null ? Math.round((d.avg || 0) * 10) / 10 : d.rating || 0)

// The dishes worth recommending (4★ and up), best first; order-again breaks a tie. If none is that
// good, the best three, so the card is never empty. `more` = how many others the place has.
export function pickShareDishes(place, max = 4) {
  const all = (place.dishes || []).map(d => ({ ...d, stars: starsOf(d) }))
  const sorted = [...all].sort((a, b) => b.stars - a.stars || (b.order_again === 'yes') - (a.order_again === 'yes'))
  const good = sorted.filter(d => d.stars >= 4)
  const shown = (good.length ? good : sorted).slice(0, good.length ? max : 3)
  return { shown, more: all.length - shown.length }
}

const starText = n => (Number.isInteger(n) ? `${n}★` : `${n.toFixed(1)}★`)

// WhatsApp text: *bold* place, one line per dish, and (map) a tappable map link
export function shareCaption(place, shown, { prices, notes, map }) {
  const where = placeWhere(place)
  const lines = [`*${place.name}*${where ? ` · ${where}` : ''}`]
  for (const d of shown) {
    const bits = [d.name, starText(d.stars)]
    if (prices && d.price) bits.push(`₹${d.price}`)
    if (notes && d.note?.trim()) bits.push(d.note.trim())
    lines.push('• ' + bits.join(' · '))
  }
  const link = map && mapsUrl(place)
  if (link) lines.push(`Map: ${link}`)
  return lines.join('\n') + '\n\nFrom my BiteMark food journal'
}

// Break text into lines that fit `width` (measure = text -> pixels), at most `max` lines; the last
// one ends in "…" when text is left over.
export function wrapLines(measure, text, width, max) {
  const lines = []
  let line = ''
  for (const w of String(text || '').trim().split(/\s+/).filter(Boolean)) {
    const t = line ? `${line} ${w}` : w
    if (!line || measure(t) <= width) line = t
    else { lines.push(line); line = w }
  }
  if (line) lines.push(line)
  if (lines.length > max) return [...lines.slice(0, max - 1), cut(measure, lines.slice(max - 1).join(' '), width)]
  return lines.map(l => (measure(l) > width ? cut(measure, l, width) : l))
}
function cut(measure, s, width) {
  while (s.length > 1 && measure(s + '…') > width) s = s.slice(0, -1)
  return s.trimEnd() + '…'
}

export const shareFileName = name =>
  (String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'place') + '-bitemark.png'
