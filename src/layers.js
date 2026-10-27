// Sheets and dialogs stack on top of each other (place details -> Send -> …). Escape must close
// only the top one, not every layer that happens to listen for the key.
import { useEffect, useRef } from 'react'

export function createLayers() {
  const stack = []
  return {
    open(close) {
      const entry = { close }
      stack.push(entry)
      return () => { const i = stack.indexOf(entry); if (i >= 0) stack.splice(i, 1) }
    },
    escape() {
      const top = stack[stack.length - 1]
      if (!top) return false
      top.close()
      return true
    },
  }
}

export const layers = createLayers()
let listening = false

// Put in every sheet / dialog: Escape closes it only while it is the top layer.
export function useEscape(onClose) {
  const latest = useRef(onClose)
  latest.current = onClose
  useEffect(() => {
    if (!listening) {
      listening = true
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !e.defaultPrevented && layers.escape()) e.preventDefault()
      })
    }
    return layers.open(() => latest.current())
  }, [])
}

// While any sheet or dialog is open the page behind must not scroll (on phones a scroll inside a
// dialog otherwise drags the page along). Counted, so nested layers unlock only when the last closes.
export function createScrollLock(style) {
  let open = 0, saved = ''
  return () => {
    if (open++ === 0) { saved = style.overflow; style.overflow = 'hidden' }
    let done = false
    return () => { if (done) return; done = true; if (--open === 0) style.overflow = saved }
  }
}

let lockBody = null
export function useScrollLock() {
  useEffect(() => {
    lockBody ??= createScrollLock(document.body.style)
    return lockBody()
  }, [])
}
