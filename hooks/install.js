// The browser's install offer for the "Install BiteMark" buttons (/install, the You menu).
// The offer is kept by INSTALL_CAPTURE_SCRIPT in the page head (lib/install.js) as window.__bmInstall.
import { useEffect, useState } from 'react'
import { installMode } from '@/lib/install'

export function useInstall() {
  const [, redraw] = useState(0)
  useEffect(() => {
    const f = () => redraw(n => n + 1)
    window.addEventListener('bm-install', f)
    const standalone = window.matchMedia?.('(display-mode: standalone)')
    standalone?.addEventListener?.('change', f)
    return () => { window.removeEventListener('bm-install', f); standalone?.removeEventListener?.('change', f) }
  }, [])
  const mode = installMode({
    ua: navigator.userAgent,
    standalone: !!window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true,
    canPrompt: !!window.__bmInstall,
    installed: !!window.__bmInstalled,
    touch: navigator.maxTouchPoints || 0,
  })
  // the browser's own "Install app?" box; true when they tapped Install
  const install = async () => {
    const offer = window.__bmInstall
    if (!offer) return false
    offer.prompt()
    const { outcome } = await offer.userChoice
    window.__bmInstall = null                     // an offer can be used once
    if (outcome === 'accepted') window.__bmInstalled = true
    redraw(n => n + 1)
    return outcome === 'accepted'
  }
  return { mode, install }
}
