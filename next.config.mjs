// BiteMark runs as a single-page app inside Next.js: the whole app is client-side (app/ClientApp.jsx).
// The two browser settings fall back to the old VITE_ names, so an existing .env or Vercel project
// keeps working until they are renamed to NEXT_PUBLIC_.
const env = name => process.env[`NEXT_PUBLIC_${name}`] || process.env[`VITE_${name}`] || ''

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  agentRules: false,          // no generated AGENTS.md: CLAUDE.md is this project's agent guide
  // like the old vercel.json: any path that isn't a file (has no dot), /api or /_next opens the app,
  // with the URL kept; unknown files and API paths still get a 404
  async rewrites() { return [{ source: '/:path((?!api/|_next/)[^.]+)', destination: '/' }] },
  env: {
    NEXT_PUBLIC_NEON_AUTH_URL: env('NEON_AUTH_URL'),
    NEXT_PUBLIC_NEON_DATA_API_URL: env('NEON_DATA_API_URL'),
  },
}
