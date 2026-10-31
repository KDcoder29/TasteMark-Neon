import ClientApp from './ClientApp'

// The one page. Every other path is rewritten here (next.config.mjs), and the app decides what to
// show from the URL itself, so this page stays static and is served from Vercel's cache.
export default function Page() {
  return <ClientApp />
}
