// The Indian-food dictionary that boosts the on-device AI model: it knows that "south indian"
// means dosa / idli / uttapam even if you never wrote "south indian" anywhere, and the other way
// round (a dosa query brings in the rest of the family). Add words freely: lower case, plain.

const TOPICS = [
  { name: 'South Indian', say: ['south indian', 'south', 'madrasi', 'udupi', 'tamil', 'kerala'],
    dishes: ['dosa', 'masala dosa', 'rava dosa', 'idli', 'uttapam', 'vada', 'medu vada', 'sambar', 'appam', 'upma', 'rasam', 'filter coffee', 'pongal', 'paniyaram', 'mysore pak'] },
  { name: 'North Indian', say: ['north indian', 'punjabi', 'mughlai'],
    dishes: ['paneer', 'butter chicken', 'dal makhani', 'naan', 'roti', 'paratha', 'kulcha', 'chole', 'rajma', 'tikka', 'biryani', 'lassi'] },
  { name: 'Gujarati', say: ['gujarati', 'kathiyawadi', 'kathiawadi'],
    dishes: ['dhokla', 'khaman', 'thepla', 'fafda', 'jalebi', 'undhiyu', 'khandvi', 'handvo', 'sev tameta', 'rotla', 'dabeli', 'khichdi', 'kadhi', 'bajra'] },
  { name: 'Chaat', say: ['chaat', 'street food', 'street'],
    dishes: ['pani puri', 'golgappa', 'bhel', 'sev puri', 'dahi puri', 'ragda', 'pav bhaji', 'vada pav', 'dabeli', 'samosa', 'kachori'] },
  { name: 'Chinese', say: ['chinese', 'indo chinese', 'asian'],
    dishes: ['noodles', 'hakka', 'manchurian', 'fried rice', 'momos', 'spring roll', 'chilli paneer', 'schezwan'] },
  { name: 'Italian', say: ['italian'], dishes: ['pizza', 'pasta', 'garlic bread', 'lasagna', 'margherita', 'risotto'] },
  { name: 'Fast food', say: ['fast food', 'junk', 'quick bite'],
    dishes: ['burger', 'pizza', 'fries', 'sandwich', 'wrap', 'frankie', 'nuggets', 'hot dog'] },
  { name: 'Coffee', say: ['coffee', 'cafe', 'caffeine'],
    dishes: ['cold coffee', 'cappuccino', 'latte', 'espresso', 'mocha', 'frappe', 'americano', 'filter coffee'] },
  { name: 'Desserts', say: ['dessert', 'sweet', 'sweets', 'mithai'],
    dishes: ['ice cream', 'kulfi', 'gulab jamun', 'rabdi', 'brownie', 'cake', 'pastry', 'jalebi', 'rasgulla', 'kaju katli', 'waffle', 'mysore pak'] },
  { name: 'Something cold', say: ['cold', 'chilled', 'summer', 'refreshing'],
    dishes: ['cold coffee', 'ice cream', 'shake', 'milkshake', 'lassi', 'chaas', 'soda', 'mojito', 'kulfi', 'smoothie', 'juice'] },
  { name: 'Spicy', say: ['spicy', 'teekha', 'tikha', 'tikhu'],
    dishes: ['chilli', 'schezwan', 'pani puri', 'misal', 'vada pav', 'tikka', 'jalapeno', 'sev tameta'] },
  { name: 'Healthy', say: ['healthy', 'diet', 'light', 'fit', 'protein', 'low cal'],
    dishes: ['salad', 'sprouts', 'protein bar', 'oats', 'millet', 'makhana', 'grilled', 'smoothie', 'muesli', 'khakhra'] },
  { name: 'Breakfast', say: ['breakfast', 'morning', 'nashta'],
    dishes: ['poha', 'upma', 'idli', 'dosa', 'thepla', 'paratha', 'sandwich', 'omelette', 'chai', 'fafda', 'jalebi'] },
  { name: 'Snacks', say: ['snack', 'snacks', 'munchies', 'evening'],
    dishes: ['chips', 'samosa', 'puff', 'khakhra', 'namkeen', 'sandwich', 'fries', 'nachos', 'makhana'] },
  { name: 'Drinks', say: ['drink', 'drinks', 'beverage', 'thirsty'],
    dishes: ['soda', 'lassi', 'chaas', 'juice', 'shake', 'mojito', 'chai', 'coffee'] },
]

const clean = s => ` ${String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `
const has = (text, phrase) => text.includes(` ${phrase} `)

// "I want south indian" -> { topics: ['South Indian'], terms: ['dosa', 'idli', …] }
export function expandQuery(text) {
  const t = clean(text)
  const topics = TOPICS.filter(tp => tp.say.some(w => has(t, w)) || tp.dishes.some(d => has(t, d)))
  return { topics: topics.map(tp => tp.name), terms: [...new Set(topics.flatMap(tp => tp.dishes))] }
}

// the families a single dish belongs to (used for "related" suggestions)
export function topicsOfDish(name) {
  const t = clean(name)
  return TOPICS.filter(tp => tp.dishes.some(d => has(t, d))).map(tp => tp.name)
}

// where a dish name starts inside a sentence: "sankalp masala dosa" -> 1 (used by Add by voice
// to tell the place from the dish). The earliest known dish wins; -1 when there is none.
export function dishWordIndex(text) {
  const words = clean(text).trim().split(' ')
  let best = -1
  for (const tp of TOPICS) for (const d of tp.dishes) {
    const dw = d.split(' ')
    for (let i = 0; i + dw.length <= words.length && (best < 0 || i < best); i++) {
      if (dw.every((w, j) => words[i + j] === w)) { best = i; break }
    }
  }
  return best
}
