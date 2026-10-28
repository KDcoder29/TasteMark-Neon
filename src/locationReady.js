import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { checkLocationSupport } from './locationSupport'

// Is saving exact locations switched on (the location migration has run)? Asked once per app start.
// Until we know, it counts as yes (a save still falls back safely, mapsSave.js); strict: only a
// confirmed yes (for background writes).
let known = null
let asking = null

export function useLocationReady({ strict = false } = {}) {
  const [ready, setReady] = useState(known)
  useEffect(() => {
    if (known !== null) return
    asking ||= checkLocationSupport(supabase).then(r => { if (r !== null) known = r; asking = null; return r })
    let live = true
    asking.then(r => { if (live) setReady(r) })
    return () => { live = false }
  }, [])
  return strict ? ready === true : ready !== false
}
