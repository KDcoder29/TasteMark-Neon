// Turns the raw text read from a bill photo into dish rows: [{ name, price }].
// OCR text is messy, so every line is judged on its own: a dish line is "some words, then a
// price at the end". Everything else (shop name, address, GST, totals, dates...) is dropped.

// lines with any of these words are never dishes
const SKIP = /\b(sub\s*total|total|gst|gstin|cgst|sgst|igst|vat|tax(es)?|service|charges?|discount|round(ed)?|net|amount|payable|bill|invoice|table|date|time|token|order|kot|cashier|fssai|ph|phone|mob(ile)?|tel|thank(s| you)?|visit|qty|rate|item|change|cash|card|upi|paid|balance|tip|packing|delivery|parcel|steward|waiter|guest|cover)\b/i

const NUM = /^\d[\d,]*(\.\d{1,2})?$/
const toNum = s => parseFloat(s.replace(/,/g, ''))
const titleCase = s => s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase())

// "2 x Vada Pav", "2 Vada Pav" -> 2. "1. Chocolate Shake" is a serial number, not a quantity.
function leadingQty(text) {
  const serial = text.match(/^\d{1,3}[.)]\s+/)
  if (serial) return { qty: 1, rest: text.slice(serial[0].length) }
  const m = text.match(/^(\d{1,2})\s*(?:[x×*]\s*|\s+)(?=[a-z])/i)
  return m ? { qty: +m[1], rest: text.slice(m[0].length) } : { qty: 1, rest: text }
}

// trailing numbers -> one per-item price
function priceFrom(nums, qty) {
  if (nums.length >= 3) return nums[nums.length - 2]                 // qty  rate  amount
  if (nums.length === 2) {
    if (qty > 1) return nums[0]                                       // 2 x Name  rate  amount
    const [a, b] = nums
    return Number.isInteger(a) && a >= 1 && a <= 10 ? b / a : a       // qty amount  |  rate amount
  }
  return nums[0] / qty
}

function parseLine(raw) {
  let line = raw
    .replace(/₹|\b(?:rs|inr)\b\.?/gi, ' ')
    .replace(/^[\s|•*#~\-]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!line || SKIP.test(line)) return null

  const { qty, rest } = leadingQty(line)
  const tokens = rest.split(' ')
  const nums = []
  while (tokens.length && NUM.test(tokens[tokens.length - 1])) nums.unshift(toNum(tokens.pop()))
  if (!nums.length) return null

  const name = tokens.join(' ')
    .replace(/[^a-z0-9&'()/\- ]/gi, ' ')     // OCR specks: | : . ~ and the like
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-/]+|[\s\-/]+$/g, '')
  if ((name.match(/[a-z]/gi) || []).length < 2) return null

  const price = Math.round(priceFrom(nums, qty))
  if (!(price > 0 && price <= 100000)) return null
  const tidy = name === name.toUpperCase() ? titleCase(name) : name
  return { name: tidy[0].toUpperCase() + tidy.slice(1), price }
}

export function parseBillText(text) {
  return String(text || '').split(/\r?\n/).map(parseLine).filter(Boolean)
}
