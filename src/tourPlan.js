// (named tourPlan.js, not tour.js: on Windows `./Tour` would load this instead of Tour.jsx)
// The 1-minute tour new people see on their first visit (and anyone can replay from the Feature
// guide). It plays like stories: scenes move on by themselves; tap to skip, hold to pause.
// The scene pictures live in TourScenes.jsx, keyed by `key`.

export const TOUR = [
  { key: 'welcome', ms: 5000, title: 'Remember every great bite', text: 'Your food journal: the places you ate at, the dishes you loved and the ones to skip.' },
  { key: 'scan', ms: 5500, title: 'Scan a bill, skip the typing', text: 'Tap + and photograph the bill. Dish names and prices fill in by themselves.' },
  { key: 'voice', ms: 5500, title: 'Or just say it', text: '“Sankalp, masala dosa, 180 rupees, 5 stars, crispy.” Hinglish works too.' },
  { key: 'rate', ms: 5500, title: 'Rate what you ate', text: 'Give each dish stars and a comment, and say if you’d order it again.' },
  { key: 'find', ms: 5500, title: 'Find anything in seconds', text: 'Search a dish or an area, or filter by city, category, price and stars.' },
  { key: 'craving', ms: 5500, title: 'Craving something?', text: 'Ask in your own words, like “south indian under ₹150”, and get your best matches.' },
  { key: 'pick', ms: 5500, title: 'Can’t decide where to eat?', text: 'Set your budget and mood, and BiteMark picks a place for you.' },
  { key: 'wish', ms: 5500, title: 'Keep a Want to try list', text: 'Save places friends recommend. When you go, tap We went and it joins your journal.' },
  { key: 'near', ms: 5500, title: 'Places near you, on a map', text: 'Your places nearest first, as a list or on a map, with travel time, and pick a few to plan a route in Google Maps.' },
  { key: 'groups', ms: 5500, title: 'Eat together in groups', text: 'Share places with friends or family and see everyone’s ratings in one card.' },
  { key: 'send', ms: 5500, title: 'Send a place to friends', text: 'Turn any place’s best dishes into a clean picture for WhatsApp.' },
  { key: 'story', ms: 5500, title: 'Your food story', text: 'Your favourite dish, your go-to food and more, in the You tab. Ready to start?' },
]

export const tourStart = () => ({ i: 0, t: 0, paused: false, done: false })

const last = TOUR.length - 1
export function tourStep(s, a) {
  switch (a.type) {
    case 'tick': {
      if (s.paused || s.done) return s
      const t = s.t + a.ms
      if (t < TOUR[s.i].ms) return { ...s, t }
      return s.i === last ? { ...s, t: TOUR[last].ms } : { ...s, i: s.i + 1, t: 0 }   // the last scene waits
    }
    case 'next': return s.i === last ? { ...s, done: true } : { ...s, i: s.i + 1, t: 0 }
    case 'prev': return { ...s, i: Math.max(0, s.i - 1), t: 0 }
    case 'go': return { ...s, i: Math.max(0, Math.min(last, a.i)), t: 0 }
    case 'pause': return { ...s, paused: true }
    case 'resume': return { ...s, paused: false }
    default: return s
  }
}

// Played by itself only for a brand-new account (nothing in the journal or Want to try yet), once
// it is sure the journal really is empty, and only the first time on this device.
export const shouldAutoTour = ({ ready, places, wish, seen }) => !!ready && !places && !wish && !seen

const KEY = 'bm.tour.'
export function tourSeen(s, uid) { try { return s?.getItem(KEY + uid) === '1' } catch { return false } }
export function markTourSeen(s, uid) { try { s?.setItem(KEY + uid, '1') } catch {} }
