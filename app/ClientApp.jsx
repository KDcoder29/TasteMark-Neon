'use client'
import { useEffect, useState } from 'react'
import AppShell from './AppShell'

// The whole app runs in the browser only, exactly as it did on Vite (it routes itself from the URL:
// /share, /reset-password, everything else). It's imported normally (so its code is listed in the
// page and downloads alongside Next's own) but only rendered once mounted in the browser.
export default function ClientApp() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    // Makes the app installable on the phone home screen (after the page has loaded, as before)
    if (!('serviceWorker' in navigator)) return
    const reg = () => navigator.serviceWorker.register('/sw.js')
    if (document.readyState === 'complete') reg(); else window.addEventListener('load', reg, { once: true })
  }, [])
  return mounted ? <AppShell /> : null
}
