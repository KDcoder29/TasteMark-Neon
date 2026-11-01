// BiteMark's screens are Next.js routes (app/); they are client components (the session lives in the browser).
// The two browser settings fall back to the old VITE_ names, so an existing .env or Vercel project
// keeps working until they are renamed to NEXT_PUBLIC_.
const env = name => process.env[`NEXT_PUBLIC_${name}`] || process.env[`VITE_${name}`] || ''

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  agentRules: false,          // no generated AGENTS.md: CLAUDE.md is this project's agent guide
  // prefetched pages stay in the browser's router cache for the whole visit (Next's default is 5 min), so
  // switching views and spaces keeps working offline, as the single-page app did. The pages hold no data.
  experimental: { staleTimes: { static: Infinity } },
  // Every group and every place address is served by ONE prebuilt page (/g/_/…, /places/_), so opening
  // a group or a place link comes from Vercel's nearby cache instead of a server function in the US
  // (each was a 0.4–1.8 s trip, on every tap). The pages hold no data; the app reads the real ids from
  // the address (lib/routes currentGroup / parsePath).
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/g/:groupId/places/:placeId', destination: '/g/_/places/_' },
        { source: '/g/:groupId/:view(want-to-try|near|activity)', destination: '/g/_/:view' },
        { source: '/g/:groupId', destination: '/g/_' },
        { source: '/places/:placeId', destination: '/places/_' },
      ],
    }
  },
  env: {
    NEXT_PUBLIC_NEON_AUTH_URL: env('NEON_AUTH_URL'),
    NEXT_PUBLIC_NEON_DATA_API_URL: env('NEON_DATA_API_URL'),
  },
}
