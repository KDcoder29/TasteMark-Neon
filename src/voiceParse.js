// "Add by voice": turns what you said into a place + dish rows for the Add place form.
//   ["Sankalp", "masala dosa 180 rupees 5 stars crispy"]
//   -> { place: 'Sankalp', dishes: [{ name: 'Masala Dosa', price: '180', rating: 5, note: 'Crispy', order_again: '' }] }
// `pieces` are the browser's speech results: each pause gives a new piece, which counts like a comma.
// Nothing here is saved; the form shows the result for you to check.
import { dishWordIndex } from './foodLexicon'

const NUM = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5,
}
const W = Object.keys(NUM).join('|')
const UNIT = '(?:rs\\.?|rupees?|rupaye|rupaiye|rupiya|rupaiya|inr|bucks)'
const STAR = '(?:stars?|⭐|out of (?:5|five)|/5)'
const YES = /\b(?:will order (?:it )?again|order (?:it )?again|ordering again|dobara(?: lenge| lunga| order)?|phir se(?: lenge)?|must try|repeat karenge)\b/
const NO = /\b(?:never again|not again|won'?t order(?: it)? again|kabhi nahi|dobara nahi)\b/

const num = s => (/\d/.test(s) ? +s : NUM[s])
const pair = (a, b) => (b && num(a) >= 20 && num(b) < 10 ? num(a) + num(b) : num(a))

// number words become digits, but only next to a price or stars ("paneer do pyaza" stays as it is)
function digits(s) {
  s = s.replace(new RegExp(`\\b(${W}|\\d+) hundred(?: and)?(?: (${W}|\\d{1,2})(?: (${W}))?)?\\b`, 'g'),
    (m, a, b, c) => String(num(a) * 100 + (b ? pair(b, c) : 0)))
  s = s.replace(new RegExp(`\\b(${W})(?: (${W}))?(?=\\s*(?:${UNIT}(?![a-z])|${STAR}|star))`, 'g'), (m, a, b) => String(pair(a, b)))
  return s.replace(new RegExp(`\\b(${UNIT}|rating|rated)\\s+(${W})(?: (${W}))?\\b`, 'g'), (m, u, a, b) => `${u} ${pair(a, b)}`)
}

const clean = s => s.replace(/\s+/g, ' ').trim().replace(/^(?:and|aur|with|it was|was|is|the)\s+/, '').replace(/\s+(?:and|aur|with)$/, '').trim()
const title = s => s.replace(/(^|\s)(\p{L})/gu, (m, sp, c) => sp + c.toUpperCase())
const sentence = s => s.charAt(0).toUpperCase() + s.slice(1)
const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

// one piece of speech -> [{ t: 'text' | 'price' | 'rating' | 'again' | 'next', v }]
function tokens(piece) {
  let s = digits(piece.toLowerCase())
  // order-again phrases first, so their words don't end up in the comment
  const again = (NO.test(s) && 'no') || (YES.test(s) && 'yes')
  s = s.replace(NO, ' ').replace(YES, ' ').replace(/\blenge\b/g, ' ')
  const re = new RegExp([
    `(?:₹|\\b${UNIT})\\s*(\\d+)`,                          // rs 20, ₹20
    `(\\d+)\\s*(?:₹|${UNIT}(?![a-z])|/-)`,                 // 20 rupees, 20rs
    `(\\d(?:\\.\\d)?)\\s*(?:${STAR}|star)`,                // 4 stars, 3 out of 5
    `\\b(?:rating|rated)\\s*(\\d)`,                        // rating 4
    `\\b(next(?: dish)?|and then)\\b`,                     // a new dish
    `\\b(\\d{2,})\\b`,                                     // a bare number above 5 is a price
  ].join('|'), 'g')
  const out = []
  const text = t => { t = clean(t.replace(/[,.;!?]/g, ' ')); if (t) out.push({ t: 'text', v: t }) }
  let at = 0, m
  while ((m = re.exec(s))) {
    text(s.slice(at, m.index))
    at = re.lastIndex
    const price = m[1] || m[2] || m[6]
    if (price) out.push({ t: 'price', v: String(Math.min(9999, +price)) })
    else if (m[3] || m[4]) out.push({ t: 'rating', v: Math.max(1, Math.min(5, Math.round(+(m[3] || m[4])))) })
    else out.push({ t: 'next' })
  }
  text(s.slice(at))
  if (again) out.push({ t: 'again', v: again })
  return out
}

const isAnchor = x => x.t === 'price' || x.t === 'rating'

export function parseSpoken(pieces, knownPlaces = []) {
  const parts = (pieces || []).flatMap(p => String(p).split(/[,;]|\.(?!\d)/)).map(p => p.trim()).filter(Boolean)
  let place = null

  // 1) a place already in your journal, said at the very start
  if (parts.length) {
    const first = norm(parts[0])
    const known = [...knownPlaces].sort((a, b) => b.length - a.length)
      .find(k => norm(k) && (first === norm(k) || first.startsWith(norm(k) + ' ')))
    if (known) { place = known; parts[0] = first.slice(norm(known).length).trim() }
  }

  let stream = parts.flatMap(tokens)
  const anchorAt = stream.findIndex(isAnchor)
  const before = stream.slice(0, anchorAt < 0 ? stream.length : anchorAt).filter(x => x.t === 'text')

  if (!place) {
    const at = before.map(x => x.v.match(/^(.*?)\s*\b(?:at|from)\s+(\D+)$/)).findIndex(Boolean)
    if (at >= 0) {
      // 2) "paneer tikka at Barbeque Nation …"
      const m = before[at].v.match(/^(.*?)\s*\b(?:at|from)\s+(\D+)$/)
      place = title(m[2].trim()); before[at].v = m[1]
    } else if (before.length >= 2 && dishWordIndex(before[0].v) !== 0) {
      // 3) "Sankalp, masala dosa, …": a first piece that isn't a dish, before the dish
      place = title(before[0].v); before[0].v = ''
    } else if (before.length === 1) {
      const words = before[0].v.split(' ')
      const k = dishWordIndex(before[0].v)
      if (k > 0) {
        // 4) all in one breath: "sankalp masala dosa 180 …" -> the dictionary finds the dish
        place = title(words.slice(0, k).join(' ')); before[0].v = words.slice(k).join(' ')
      } else if (k < 0 && anchorAt < 0 && stream.length === 1) {
        place = title(before[0].v); before[0].v = ''           // only a name was said
      }
    }
  }

  // 5) build the dishes
  const dishes = []
  let cur = null
  const start = name => { cur = { name, price: '', rating: 0, note: '', order_again: '' }; dishes.push(cur) }
  const addNote = v => { cur.note = cur.note ? `${cur.note} ${v}` : v }
  stream = stream.filter(x => !(x.t === 'text' && !x.v))
  stream.forEach((x, i) => {
    const next = stream[i + 1]
    if (x.t === 'next') { cur = null; return }
    if (x.t === 'text') {
      if (!cur) return start(x.v)
      if (!cur.name) { cur.name = x.v; return }
      // a new dish starts where the next price / stars would repeat what this dish already has
      if (next && ((next.t === 'price' && cur.price) || (next.t === 'rating' && cur.rating))) {
        const k = x.v.includes(' ') ? dishWordIndex(x.v) : -1
        if (k > 0) { const w = x.v.split(' '); addNote(w.slice(0, k).join(' ')); return start(w.slice(k).join(' ')) }
        return start(x.v)
      }
      return addNote(x.v)
    }
    if (!cur || (x.t === 'price' && cur.price) || (x.t === 'rating' && cur.rating)) start('')
    if (x.t === 'price') cur.price = x.v
    else if (x.t === 'rating') cur.rating = x.v
    else cur.order_again = x.v
  })

  return {
    place,
    dishes: dishes.filter(d => d.name || d.price).map(d => ({ ...d, name: title(d.name), note: sentence(d.note) })),
  }
}
