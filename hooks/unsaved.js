// React side of the unsaved-changes guard (lib/unsaved.js).
import { useEffect, useId, useRef } from 'react'
import { appUnsaved } from '@/lib/unsaved'

// Report this component's unsaved changes while `changed` is true.
//   scope = what closing asks about ('placeForm', 'place', 'groups', …: the same name guardClose uses)
//   what  = how the dialog names it ('“Sankalp”', 'this new place', 'your comment')
//   save  = the form's own save: resolves true when saved, false when it stayed open (e.g. a missing name)
//   close = how the phone's Back closes it afterwards (leave out: Back simply carries on)
export function useUnsaved({ scope, changed, what, save, close }) {
  const id = useId()
  const fns = useRef({})
  fns.current = { save, close }
  useEffect(() => {
    appUnsaved()?.set(id, changed ? {
      scope, what,
      save: save ? () => fns.current.save() : undefined,
      close: close ? () => fns.current.close() : undefined,
    } : null)
  }, [changed, scope, what, !!save, !!close])
  useEffect(() => () => appUnsaved()?.set(id, null), [])
}

// A close (✕, tap outside, Escape, swipe down) that first asks when `scope` has unsaved changes.
// Resolves false after "Keep editing" or a Save that failed (a swiped-away sheet then slides back).
export const guardClose = (scope, onClose) => async () => {
  const u = appUnsaved()
  if (u && !(await u.leave(scope))) return false
  onClose()
  return true
}
