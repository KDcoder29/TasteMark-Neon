// The unsaved-changes guard. A form (or a half-written comment) that has changes reports them here
// (hooks/unsaved.js useUnsaved). Closing it then asks "Save your changes?"
// in BiteMark's own dialog — Save / Continue without saving / Keep editing — whichever way it is closed:
//  - ✕, a tap outside, Escape: the close goes through leave(scope) (guardClose in hooks/unsaved.js);
//  - the phone's Back button: while anything is unsaved there is one extra history step; Back lands on
//    it, we ask, and Keep editing (or a Save that fails) puts the step back;
//  - refresh / closing the tab: the browser's own "Leave site?" warning (it can't be restyled).
import { askChoice } from '@/lib/dialogs'

const blank = v => v == null || v === '' || (Array.isArray(v) && v.length === 0)

// Did the person really change something? Blanks ('' / null / undefined / []) count as the same,
// and 120 equals '120' (inputs hold text), so opening a form and closing it untouched never asks.
export function isChanged(a, b) {
  if (blank(a) && blank(b)) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return true
    return a.some((x, i) => isChanged(x, b[i]))
  }
  if (a && b && typeof a === 'object' && typeof b === 'object')
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].some(k => isChanged(a[k], b[k]))
  if (typeof a === 'object' || typeof b === 'object') return true
  return String(a).trim() !== String(b).trim()
}

// the question (lib/dialogs askChoice); Save only when the thing can save itself
export const savePrompt = (what, canSave = true) => ({
  title: 'Save your changes?',
  message: `You’ve changed ${what} and haven’t saved it.`,
  choices: [
    ...(canSave ? [{ value: 'save', label: 'Save', tone: 'pri' }] : []),
    { value: 'discard', label: 'Continue without saving', tone: 'danger' },
    { value: 'keep', label: 'Keep editing', tone: 'plain' },
  ],
  dismiss: 'keep',
})

const GUARD = '__bmUnsaved'

// win = window (or a stand-in in tests); ask(opts) -> Promise<'save' | 'discard' | 'keep'>
export function createUnsaved({ win, ask }) {
  const entries = new Map()        // id -> { scope, what, save?, close? }
  let armed = false                // the extra history step is there
  let skip = 0                     // pops we caused ourselves
  let waiting = []

  const arm = () => {
    if (armed) return
    armed = true
    win.history.pushState({ ...(win.history.state || {}), [GUARD]: true }, '', win.location.href)
  }
  // take the extra step away again — only when it is still the one on screen (if a link was opened
  // meanwhile, stepping back would undo that instead)
  const disarm = () => {
    if (!armed) return Promise.resolve()
    armed = false
    if (!win.history.state?.[GUARD]) return Promise.resolve()
    return new Promise(resolve => {
      skip++
      waiting.push(resolve)
      setTimeout(resolve, 500)      // never hang a close on a pop that doesn't come
      win.history.back()
    })
  }

  win.addEventListener('popstate', () => {
    if (skip) { skip--; const w = waiting; waiting = []; w.forEach(r => r()); return }
    if (!armed) return
    armed = false                  // Back left the extra step
    const top = [...entries.values()].at(-1)
    if (!top) return
    decide([top]).then(go => {
      if (!go) return arm()                             // Keep editing, or Save failed: the step comes back
      if (top.close) top.close()
      else win.history.back()                           // nothing of its own to close: carry on Back
    })
  })
  // ask about these entries; true = go ahead (saved, or Continue without saving)
  async function decide(mine) {
    const savers = mine.filter(e => e.save)
    const answer = await ask(savePrompt(mine.at(-1).what, savers.length > 0))
    if (answer === 'discard') return true
    if (answer !== 'save') return false
    for (const e of savers) if (!(await e.save())) return false   // a form shows its own error and stays
    return true
  }

  win.addEventListener('beforeunload', e => {
    if (!entries.size) return
    e.preventDefault()
    e.returnValue = ''
  })

  return {
    // entry = { scope, what, close? } while changed; null when clean or gone
    set(id, entry) {
      if (entry) {
        const first = !entries.size
        entries.set(id, entry)
        if (first) arm()
      } else if (entries.delete(id) && !entries.size) disarm()
    },
    dirty: scope => [...entries.values()].some(e => !scope || e.scope === scope),
    // ask before closing `scope`; true = go ahead and close
    async leave(scope) {
      const mine = [...entries].filter(([, e]) => e.scope === scope)
      if (!mine.length) return true
      if (!(await decide(mine.map(([, e]) => e)))) return false
      mine.forEach(([id]) => entries.delete(id))
      if (!entries.size) await disarm()
      return true
    },
  }
}

// the app's one guard (none while prerendering on the server)
let app = null
export function appUnsaved() {
  if (!app && typeof window !== 'undefined') app = createUnsaved({ win: window, ask: askChoice })
  return app
}
