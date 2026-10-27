// Rules for the Add / Edit place form, kept apart from the UI so they can be tested.
import { isMapsLink } from './mapsLink'

export const MAPS_HINT = 'That isn’t a Google Maps link. In Google Maps tap Share, then Copy link, and paste it here (or leave it empty).'

export const blankDish = () => ({ name: '', price: '', rating: 0, order_again: '', note: '' })

const isBlank = d => !String(d.name).trim() && d.price === ''

const key = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')

// A long bill can be captured in parts; re-photographing the same part must not add the same
// dishes twice. Returns only the scanned dishes not already in the list (or earlier in the scan).
export function newScannedDishes(dishes, scanned) {
  const seen = new Set(dishes.map(d => key(d.name)).filter(Boolean))
  return (scanned || []).filter(s => {
    const k = key(s.name)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// Bill scan results -> dish rows. Only name and price come from the bill; you add stars and a
// comment yourself. Untouched empty rows are dropped so the list doesn't start with a blank one.
export function mergeScannedDishes(dishes, scanned) {
  if (!scanned?.length) return dishes
  return [
    ...dishes.filter(d => !isBlank(d)),
    ...scanned.map(s => ({ ...blankDish(), name: s.name, price: String(s.price) })),
  ]
}

// '' when the form can be saved, otherwise the message to show
export function placeFormError({ f, cats, dishes, editingGroup }) {
  if (!f.name.trim() || !f.city.trim() || !f.area.trim()) return 'Please fill in place name, city and area.'
  if (!cats.length) return 'Pick at least one category.'
  if (f.maps_url?.trim() && !isMapsLink(f.maps_url.trim())) return MAPS_HINT
  if (editingGroup) return ''
  for (const d of dishes) {
    if (!String(d.name).trim() || d.price === '') return 'Every dish needs a name and a price.'
    if (!d.rating) return 'Please give every dish a star rating.'
    if (!String(d.note || '').trim()) return 'Please write a comment for every dish.'
  }
  return ''
}

// Add by voice -> dish rows. Unlike a bill, voice brings stars, comment and order-again too.
// A dish you already have in the list only gets its EMPTY parts filled; what you typed stays.
export function mergeSpokenDishes(dishes, spoken) {
  if (!spoken?.length) return dishes
  const out = dishes.filter(d => !isBlank(d)).map(d => ({ ...d }))
  for (const s of spoken) {
    const same = out.find(d => key(d.name) === key(s.name))
    if (!same) { out.push({ ...blankDish(), ...s }); continue }
    if (same.price === '' && s.price !== '') same.price = s.price
    if (!same.rating && s.rating) same.rating = s.rating
    if (!same.order_again && s.order_again) same.order_again = s.order_again
    if (!String(same.note).trim() && s.note) same.note = s.note
  }
  return out
}
