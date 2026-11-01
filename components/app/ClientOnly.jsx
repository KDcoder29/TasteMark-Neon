'use client'
import { useEffect, useState } from 'react'

// BiteMark's screens run in the browser only (the session, the theme and the saved journal live
// there), as on Vite: rendered once mounted, so the server sends an empty page and nothing mismatches.
export default function ClientOnly({ children }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? children : null
}
