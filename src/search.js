// Smart search for the journal.
// A query word matches a word in your notes if it is (best match first):
//   1. the same word (egg = eggs, sandwiches = sandwich)         score 1.0
//   2. the start of a word (choco -> chocolate; works while typing) 0.85
//   3. a related word (egg -> omelette, anda; lassi -> chaas)       0.7
//   4. inside a word / run together (vadapav = vada pav)            0.6
//   5. a near spelling (omlet -> omelette, panner -> paneer)        0.5
// Every word you type must match somewhere (place name, area, city, category, dish, note).

// Groups of words that mean the same / closely related thing. Add your own words freely.
const GROUPS = [
  ['egg', 'anda', 'omlet', 'omelet', 'omelette', 'bhurji', 'boiled', 'khema'],
  ['icecream', 'kulfi', 'gelato', 'scoop', 'sundae', 'matka'],
  ['shake', 'milkshake', 'thickshake', 'smoothie', 'frappe'],
  ['lassi', 'chaas', 'chhas', 'buttermilk', 'chaach'],
  ['coffee', 'cappuccino', 'mocha', 'latte', 'espresso', 'americano', 'cafe'],
  ['tea', 'chai'],
  ['chocolate', 'choco', 'cocoa', 'cacao', 'brownie', 'kitkat'],
  ['pizza', 'margherita', 'romanio', 'farmhouse'],
  ['sandwich', 'sandwhich', 'sub', 'toast', 'grill'],
  ['frankie', 'wrap', 'roll', 'kathi'],
  ['dosa', 'dosai', 'uttapam', 'uttapa', 'appam', 'aapam', 'paniyaram'],
  ['puff', 'patty', 'pastry'],
  ['burger', 'slider'],
  ['pasta', 'macaroni', 'spaghetti', 'penne', 'noodle'],
  ['paneer', 'cottage'],
  ['cheese', 'cheesy', 'cheez', 'paneer'],
  ['potato', 'aloo', 'batata', 'fries'],
  ['bread', 'bun', 'pav', 'roti', 'paratha'],
  ['lemon', 'limbu', 'nimbu', 'lime'],
  ['mango', 'aam'],
  ['guava', 'peru', 'jamphal'],
  ['dessert', 'sweet', 'mithai', 'meetha', 'sweets', 'sugar'],
  ['spicy', 'tikho', 'tikhu', 'tikha', 'teekha', 'hot', 'chilli', 'chili', 'jalapeno'],
  ['bad', 'bhangar', 'worst', 'waste', 'avoid', 'terrible'],
  ['best', 'mast', 'sexy', 'kadak', 'yummy', 'yummyy', 'lovely', 'superb', 'excellent', 'amazing', 'awesome'],
  ['cheap', 'budget', 'affordable'],
  ['soda', 'mojito', 'fizzy', 'drink'],
  ['salad', 'healthy'],
  ['protein', 'protien', 'fit', 'nutrition', 'workout', 'gym', 'healthy'],
  ['chips', 'chip', 'wafer', 'wafers', 'khakhra', 'khakhara', 'chakli', 'crisps', 'namkeen', 'crunchy'],
  ['bar', 'granola', 'muesli', 'energybar'],
  ['snack', 'snacks', 'munchies', 'nibble'],
]

const stripAccents = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const squash = w => w.replace(/(.)\1+/g, '$1')   // "yummyy" -> "yumy" (only used for fuzzy compare)

export function stem(w) {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.length > 4 && /(ches|shes|xes|sses)$/.test(w)) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1)
  return w
}

export function words(text) {
  return stripAccents(String(text || '').toLowerCase())
    .replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean).map(stem)
}

// ice cream / icecream: "ice cream" is treated as the one word "icecream" too
const SYNS = new Map()
for (const g of GROUPS) {
  const gs = g.map(stem)
  for (const w of gs) SYNS.set(w, [...(SYNS.get(w) || []), ...gs])
}
const related = w => SYNS.get(w) || []

function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      cur.push(v); if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

// how well one query word matches a list of document words (0 = no match)
function wordScore(t, docWords, joined) {
  let best = 0
  const rel = related(t)
  for (const w of docWords) {
    let s = 0
    if (w === t) s = 1
    else if (t.length >= 2 && w.startsWith(t)) s = 0.85
    else if (rel.includes(w) || (related(w).includes(t))) s = 0.7
    else if (t.length >= 4 && w.includes(t)) s = 0.6
    else if (rel.some(r => r.length >= 3 && w.startsWith(r))) s = 0.55
    else if (t.length >= 4 && w[0] === t[0]) {   // typos rarely change the first letter
      const max = t.length >= 8 ? 2 : 1
      const a = squash(t), b = squash(w)
      if (b.length >= 4 && editDistance(a, b, max) <= max) s = 0.5
      else if (w.length > t.length + 1 && editDistance(a, squash(w.slice(0, t.length)), max) <= max) s = 0.45
    }
    if (s > best) best = s
    if (best === 1) return 1
  }
  // run-together words: "vadapav" in "vada pav", "icecream" in "ice cream"
  if (best < 0.6 && t.length >= 4 && joined.includes(t)) best = 0.6
  return best
}

// returns 0 when the query does not match; otherwise a score (higher = better)
export function matchScore(query, ...texts) {
  const q = words(query)
  if (!q.length) return 1
  const docWords = words(texts.join(' '))
  const joined = docWords.join('')
  // the whole query written as one word: "vada pav" = "vadapav"
  const qj = q.join('')
  if (q.length > 1 && qj.length >= 4 && joined.includes(qj)) return 0.6
  let total = 0
  for (const t of q) {
    const s = wordScore(t, docWords, joined)
    if (!s) return 0
    total += s
  }
  return total / q.length
}
