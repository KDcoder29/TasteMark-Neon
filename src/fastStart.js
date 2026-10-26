// Makes login and app start feel instant despite the database being in the US:
//  - remembers username -> email on this device, so the next login skips that lookup trip
//  - keeps a snapshot of each journal (per person + space) to show at once, then refreshes it
// Journal snapshots are cleared on log out. All storage access is best-effort (private mode etc.).
const LOGIN = 'bm.login'
const SNAP = 'bm.snap.'           // + uid + '.' + space
const VERSION = 1

const read = (s, k) => { try { return s?.getItem(k) ?? null } catch { return null } }
const write = (s, k, v) => { try { s?.setItem(k, v) } catch { /* full or blocked: just no snapshot */ } }

export function rememberLogin(s, identity, email) {
  if (!identity || identity.includes('@') || !email) return
  let map = {}
  try { map = JSON.parse(read(s, LOGIN) || '{}') } catch {}
  map[identity.trim().toLowerCase()] = email
  write(s, LOGIN, JSON.stringify(map))
}

export function recallEmail(s, identity) {
  try { return JSON.parse(read(s, LOGIN) || '{}')[String(identity).trim().toLowerCase()] || null } catch { return null }
}

export function saveJournal(s, uid, space, data) {
  write(s, SNAP + uid + '.' + space, JSON.stringify({ v: VERSION, uid, data }))
}

export function loadJournal(s, uid, space) {
  try {
    const snap = JSON.parse(read(s, SNAP + uid + '.' + space))
    return snap?.v === VERSION && snap.uid === uid ? snap.data : null
  } catch { return null }
}

export function clearFastStart(s) {
  try {
    const keys = []
    // journal snapshots go; the username -> email memory stays (it holds no journal data and is
    // exactly what makes the next login fast)
    for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k?.startsWith(SNAP)) keys.push(k) }
    keys.forEach(k => s.removeItem(k))
  } catch {}
}
