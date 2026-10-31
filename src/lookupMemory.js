// Area lookups that found nothing, remembered on this device (localStorage), so the same unknown
// landmark isn't asked of the free OpenStreetMap searches on every app start. It is tried again
// after 14 days, or straight away once its landmark or city changes.
const KEY = 'bm.areamiss'
const RETRY = 14 * 864e5
const sig = it => [it.area, it.city].map(x => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim()).join('|')

function read(s) {
  try { const v = JSON.parse(s?.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} }
}

export function shouldLookup(s, it, now = Date.now()) {
  const miss = read(s)[`${it.table}:${it.id}`]
  return !miss || miss.sig !== sig(it) || now - miss.at >= RETRY
}

export function rememberMiss(s, it, now = Date.now()) {
  try { s?.setItem(KEY, JSON.stringify({ ...read(s), [`${it.table}:${it.id}`]: { sig: sig(it), at: now } })) } catch {}
}
