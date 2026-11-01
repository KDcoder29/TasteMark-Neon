// The app's addresses (Next.js routes, see app/(app)/). Personal lives at the root, a group under
// /g/<id>; each space has the same views. Pure, so the shell, the space layouts and tests share it.
const VIEW_PATH = { journal: '', wishlist: '/want-to-try', near: '/near', activity: '/activity' }
const PATH_VIEW = { 'want-to-try': 'wishlist', near: 'near', activity: 'activity' }
const SHEETS = ['groups', 'you']

export const spaceBase = groupId => (groupId ? `/g/${encodeURIComponent(groupId)}` : '')

export const viewHref = (view, groupId) => spaceBase(groupId) + (VIEW_PATH[view] || '') || '/'

export const placeHref = (placeId, groupId) => `${spaceBase(groupId)}/places/${placeId}`

// a malformed % (e.g. /g/100%) must never crash a screen
export const safeDecode = s => { try { return decodeURIComponent(s) } catch { return s } }
const decode = safeDecode

// '/g/g1/places/p9' -> { groupId: 'g1', view: 'journal', placeId: 'p9', sheet: null }.
// Anything unknown reads as the journal with nulls.
export function parsePath(pathname) {
  const out = { groupId: null, view: 'journal', placeId: null, sheet: null }
  let parts = String(pathname || '').split('/').filter(Boolean)
  if (parts[0] === 'g' && parts[1]) { out.groupId = decode(parts[1]); parts = parts.slice(2) }
  const [a, b] = parts
  if (a === 'places' && b) out.placeId = decode(b)
  else if (PATH_VIEW[a]) out.view = PATH_VIEW[a]
  else if (!out.groupId && SHEETS.includes(a)) out.sheet = a
  return out
}

// The space and view of the page in the (app) layout's children slot, from its selected segments
// (useSelectedLayoutSegments: e.g. ['(personal)', 'near'] or ['g', 'g1', 'activity']). Unlike the
// address, these stay on the page underneath while an intercepted overlay (/places/[id]) is open.
export function spaceFromSegments(segments) {
  let parts = (Array.isArray(segments) ? segments : []).filter(s => typeof s === 'string' && !s.startsWith('(') && !s.startsWith('__'))
  let groupId = null
  if (parts[0] === 'g' && parts[1]) { groupId = decode(parts[1]); parts = parts.slice(2) }
  return { groupId, view: PATH_VIEW[parts[0]] || 'journal' }
}

// After create / join / leave / delete (AppProvider groupsChanged): the space to open now (`go`), or
// once the Groups sheet closes (`pending`), so the sheet stays up with its message (invite code hint,
// "You left"). Leaving the open group under the sheet needs nothing: the group space goes to Personal
// itself once the sheet is closed (GroupSpace).
export function groupsChangeTarget({ newId, open, list, sheetOpen }) {
  if (newId && list.some(g => g.id === newId)) return sheetOpen ? { go: null, pending: newId } : { go: newId, pending: null }
  if (open && !list.some(g => g.id === open) && !sheetOpen) return { go: 'personal', pending: null }
  return { go: null, pending: null }
}
