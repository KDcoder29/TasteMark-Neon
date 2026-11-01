'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Login from '@/components/auth/Login'
import ClientOnly from '@/components/app/ClientOnly'
import ErrorBoundary from '@/components/app/ErrorBoundary'
import { supabase } from '@/lib/supabase'
import { safeNext } from '@/lib/nextPath'

// /login?next=<address>: the login screen (log in, sign up, forgot password, Try the demo). After a
// session it goes to `next` (same-site paths only, see safeNext) or /. Someone who is already logged in
// is sent straight on. Reads the query at use time (not useSearchParams) so the page stays static.
export default function LoginPage() {
  const router = useRouter()
  const next = () => safeNext(new URLSearchParams(window.location.search).get('next'))
  useEffect(() => {
    let live = true
    router.prefetch(next())   // load the app while the visitor types, so login → journal doesn't wait for it
    supabase.auth.getSession().then(({ data }) => { if (live && data?.session) router.replace(next()) }).catch(() => {})
    return () => { live = false }
  }, [])
  return <ClientOnly><ErrorBoundary><Login onSession={() => router.replace(next())} /></ErrorBoundary></ClientOnly>
}
