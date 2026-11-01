'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import AppProvider, { useApp } from '@/components/app/AppProvider'
import Shell from '@/components/app/Shell'
import { loginHref } from '@/lib/nextPath'
import ClientOnly from '@/components/app/ClientOnly'
import ErrorBoundary from '@/components/app/ErrorBoundary'
import DialogHost from '@/components/app/DialogHost'

// The signed-in app: app state (AppProvider), the session gate, and the shell (sidebar, bottom bar,
// + menu, app sheets) around the open space (children) and the routed overlays (@modal).
export default function AppLayout({ children, modal }) {
  return (
    <ClientOnly>
      <ErrorBoundary>
        <AppProvider><Gate modal={modal}>{children}</Gate></AppProvider>
        <DialogHost />
      </ErrorBoundary>
    </ClientOnly>
  )
}

function Gate({ children, modal }) {
  const { session, demoWaiting } = useApp()
  // SESSION GATE (Task 3c) — start
  // Runs on every render, before any early return, so hooks (useEffect for a redirect) can live here.
  // `loggedOutScreen` is what shows when the session check answered "no session".
  const pathname = usePathname(), router = useRouter()
  // Only a real "no session" answer (session === null) sends you to /login; while the check runs
  // (undefined) or the device runs from a cached session (offline start) nothing redirects.
  useEffect(() => {
    if (session === null) router.replace(loginHref(pathname, window.location.search))
  }, [session, pathname, router])
  const loggedOutScreen = <div className="p-10"><div className="skel mx-auto max-w-md" /></div>   // while /login opens
  // SESSION GATE (Task 3c) — end
  if (session === undefined) return <div className="p-10"><div className="skel mx-auto max-w-md" /></div>
  if (!session) return loggedOutScreen
  if (demoWaiting) return (
    <div className="demo-wait">
      <div>
        <div className="scanbar mx-auto mb-4 w-40" aria-hidden="true" />
        <p className="m-0 font-semibold">Setting up the demo journal…</p>
        <p className="m-0 mt-1 text-sm" style={{ color: 'var(--mute)' }}>72 places in Vadodara and Ahmedabad</p>
      </div>
    </div>
  )
  return <Shell modal={modal}>{children}</Shell>
}
