'use client'
import ClientOnly from '@/components/app/ClientOnly'
import InstallPage from '@/components/install/InstallPage'

// /install: the link to send friends. No login needed (lib/earlyStart lets it through); it reads the
// browser, so it draws on the device only.
export default function Install() {
  return <ClientOnly><InstallPage /></ClientOnly>
}
