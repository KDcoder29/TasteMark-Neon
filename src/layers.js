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
