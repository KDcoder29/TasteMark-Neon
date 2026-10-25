// Rules for the Add / Edit place form, kept apart from the UI so they can be tested.

export const blankDish = () => ({ name: '', price: '', rating: 0, order_again: '', note: '' })

const isBlank = d => !String(d.name).trim() && d.price === ''

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
