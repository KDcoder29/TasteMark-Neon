// A place's contact number (optional). There is no free source that has it for Indian restaurants
// (OpenStreetMap had 1 in 77 of the demo places), so the form opens a Google Maps search and you
// paste what you copied there: the number (and a Maps link, if the copied text has one) fills in.
import { findMapsLink } from '@/lib/mapsLink'

export const PHONE_HINT = 'That doesn’t look like a phone number. Check it, or leave it empty.'

const digits = s => String(s || '').replace(/\D/g, '')

// a typed number: 8 to 15 digits, with + ( ) - and spaces allowed
export function isPhone(s) {
  if (typeof s !== 'string' || !/^\+?[\d\s()-]+$/.test(s.trim())) return false
  const n = digits(s).length
  return n >= 8 && n <= 15
}

// The first phone number in pasted text. Links are taken out first (their digits are not a number),
// and a number never runs across lines; 10 to 13 digits, so prices, PIN codes and years don't count.
export function findPhone(text) {
  const plain = String(text || '').replace(/https?:\/\/\S+/g, ' ')
  for (const m of plain.match(/\+?\(?\d[\d \t()-]{6,}\d/g) || []) {
    const s = m.trim(), n = digits(s).length
    if (n >= 10 && n <= 13) return s
  }
  return null
}

// one paste can bring both: a copied Google Maps block often has the link and the number
export const pastedContact = text => ({ phone: findPhone(text), link: findMapsLink(text) })

// tap to call: only the digits and a leading +
export function telHref(phone) {
  const n = digits(phone)
  if (!n) return null
  return 'tel:' + (String(phone).trim().startsWith('+') ? '+' : '') + n
}
