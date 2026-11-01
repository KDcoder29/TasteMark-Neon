'use client'
import { useEffect } from 'react'

// Makes the app installable on the phone home screen (registered after the page has loaded, as before).
// In the root layout, so every address registers it.
export default function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const reg = () => navigator.serviceWorker.register('/sw.js')
    if (document.readyState === 'complete') reg(); else window.addEventListener('load', reg, { once: true })
  }, [])
  return null
}
