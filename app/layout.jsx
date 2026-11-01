import '@/styles/globals.css'
import ServiceWorker from '@/components/app/ServiceWorker'
import { EARLY_START_SCRIPT } from '@/lib/earlyStart'

// The page head that index.html used to have. The screens are client-side: app/(app)/layout.jsx
// (the signed-in app), app/(auth)/…, app/share.
export const metadata = {
  title: 'BiteMark',
  description: 'BiteMark: remember every great bite.',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f3ead8',
}

const AUTH = process.env.NEXT_PUBLIC_NEON_AUTH_URL
const DATA = process.env.NEXT_PUBLIC_NEON_DATA_API_URL

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: the head script below sets data-theme before React starts
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* first thing: the saved theme, and the hop to /login for a logged-out visitor (lib/earlyStart) */}
        <script dangerouslySetInnerHTML={{ __html: EARLY_START_SCRIPT }} />
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* open the connections to the login server and the data API early (they're in the US: each new
            secure connection costs ~0.6–1 s from India) */}
        {AUTH && <link rel="preconnect" href={AUTH} crossOrigin="" />}
        {DATA && <link rel="preconnect" href={DATA} crossOrigin="" />}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="BiteMark" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>{children}<ServiceWorker /></body>
    </html>
  )
}
