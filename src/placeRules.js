// Rules for the Add / Edit place form, kept apart from the UI so they can be tested.

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
  if (editingGroup) return ''
  for (const d of dishes) {
    if (!String(d.name).trim() || d.price === '') return 'Every dish needs a name and a price.'
    if (!d.rating) return 'Please give every dish a star rating.'
    if (!String(d.note || '').trim()) return 'Please write a comment for every dish.'
  }
  return ''
}
