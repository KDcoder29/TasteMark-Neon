'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { stashShare } from '@/lib/shareTarget'
import { likelyLoggedIn } from '@/lib/earlyStart'

// A place shared from Google Maps (the PWA share target) lands here. Keep it for the app (taken after
// login / once the demo is ready, see AppProvider), then open the app: / when logged in, /login when not.
export default function SharePage() {
  const router = useRouter()
  useEffect(() => {
    let store = null
    try { store = window.sessionStorage } catch {}
    const q = new URLSearchParams(window.location.search)
    stashShare(store, { title: q.get('title') || '', text: q.get('text') || '', url: q.get('url') || '' })
    // at once, from this device's logged-in hint (no trip to the login server): a wrong guess is
    // corrected by the session gate (/ → /login) or by /login (session → /), and the share waits either way
    let local = null
    try { local = window.localStorage } catch {}
    router.replace(likelyLoggedIn(local) ? '/' : '/login')
  }, [])
  return null
}
