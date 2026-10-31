# Next.js Migration (single-page mode) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BiteMark runs on Next.js (same Vercel project), with every feature and the UI exactly as today.

**Architecture:**
- The Next.js App Router hosts today's client-side `<App/>` through one catch-all page that loads it in the browser only (`dynamic(..., { ssr: false })`).
- `app/layout.jsx` carries the old `index.html` head.
- The two Vercel `api/` functions become App Router route handlers through a small tested adapter, with their logic moved to `server/`.
- `src/` stays put; only the entry and the environment reads change.

**Tech Stack:** Next.js 16.4.3 (pinned exact), React 19, Tailwind 4 via `@tailwindcss/postcss`, Vitest (kept, with its own `vitest.config.js`), Playwright MCP for the before/after walkthrough.

**Spec:** `docs/superpowers/specs/2026-10-31-nextjs-migration-design.md`

## Global Constraints

- **The UI and behaviour stay identical:**
  - no visual, copy or interaction changes;
  - phone (390 px) and desktop (1280 px), light and dark.
- **No server-side rendering of the app:** `<App/>` is loaded with `ssr: false`; the app keeps its own `window.location` routing (`/share`, `/reset-password`).
- **API contracts identical:** `GET /api/auth-lookup` (`?ping`, `?username=`, `?available=`) and `GET /api/maps-resolve?url=`, with the same JSON bodies, status codes and the `Cache-Control: no-store` header.
- **Environment:** browser variables `NEXT_PUBLIC_NEON_AUTH_URL` and `NEXT_PUBLIC_NEON_DATA_API_URL`; server-only `DATABASE_URL`. Never print `.env` contents.
- **`public/` unchanged** (manifest with `share_target` `/share`, `sw.js`, icons, demo assets).
- **No new paid services; no database changes.**
- **Git:** no git state changes by agents. "Commit" steps are done by Kandarp. Never create `foo.js` next to `Foo.jsx`. Preserve CRLF where a file has it.
- **Tests:** `npx vitest run` passes everywhere (all existing tests plus new ones).
- **Size:** the first-load JS stays within +10 % of the Vite build's main chunk (850.7 kB, gzip 237 kB).

## Review Focus

1. **Deep links on a full page load** (`/share?text=…`, `/reset-password?token=…`, any unknown path) reach the app with the query string intact. Covered in Task 2, Playwright step.
2. **Missing environment variable at build or runtime:** the app shows its existing behaviour (no crash at import time). Covered in Task 2 (`env.js` test).
3. **The API adapter on bad input:** a missing query gives the same 400 JSON, and a thrown error gives the same 500 JSON. Covered in Task 3 tests.
4. **Heavy client-only libraries** (transformers.js, tesseract.js, Leaflet plugins needing `window.L`) still load on demand after `next build`, and don't break the server build. Covered in Task 4, the build plus Playwright on the Craving chat, bill scan and Near me.
5. **Service worker and installability** still register (`/sw.js` served at the root, manifest linked), and the theme colour and iOS meta are present. Covered in Task 2, Playwright step.

---

### Task 1: Baseline capture (the "before")

**Files:**
- Create: `C:/Users/KANDARP/AppData/Local/Temp/claude/k--Projects-food-journal-Projects-tastemark-neon/2d7a8b06-5720-4dd5-885f-5c390b64ba05/scratchpad/baseline/` (screenshots and `baseline.md`). This is outside the repo.

**Interfaces:**
- Produces: `baseline.md`, listing each screen state with its screenshot filename at 390x844 and 1280x800, light and dark. Task 5 reproduces the same list on Next.js.

- [ ] **Step 1:** With the current Vite dev server (http://localhost:5174, the app unchanged on this branch), log in with **Try the demo** and capture these states:
  - login page;
  - journal list;
  - search with results; filter sheet (phone) or chips (desktop); sort menu;
  - place detail; edit form; Send picture sheet;
  - the + menu; add by hand form;
  - Want to try; group space; activity;
  - Craving chat with one answer; Where to eat;
  - You tab, food story; Feature guide; one tour scene;
  - Near me List; Near me Map: bubbles, a selected card with route, heatmap on, crawl planned, replay end card, full screen;
  - `/share?text=Test%0AAlkapuri,%20Vadodara` sheet;
  - `/reset-password` page.

  Do this in both themes at both widths. Also record:
  - the main JS chunk size from `npx vite build --outDir <scratch>/vite-build`;
  - the `/api/auth-lookup?ping=1` response body and status.
- [ ] **Step 2:** Write `baseline.md` with the list and the sizes. Expected: one file and about 100 PNGs. No repo files changed (`git status` is clean).

### Task 2: Next.js shell (layout, catch-all page, environment, Tailwind, Vitest config)

**Files:**
- Create: `app/layout.jsx`, `app/[[...path]]/page.jsx`, `app/ClientApp.jsx`, `src/env.js`, `src/env.test.js`, `next.config.mjs`, `postcss.config.mjs`, `vitest.config.js`, `jsconfig.json` (only if needed)
- Modify: `package.json` (deps and scripts), `.gitignore` (add `.next/`), `src/supabase.js`, `src/authApi.js`, `src/Login.jsx` (environment reads only)
- Delete: `index.html`, `src/main.jsx`, `vite.config.js` (after `vitest.config.js` exists)

**Interfaces:**
- Produces:
  - `src/env.js`, exporting `AUTH_URL: string` and `DATA_API_URL: string`.
    - Read via `process.env.NEXT_PUBLIC_NEON_AUTH_URL` / `process.env.NEXT_PUBLIC_NEON_DATA_API_URL`, written literally so Next inlines them.
    - `''` when unset.
    - The trailing slash is NOT stripped here, because callers already do it as today.
  - Plus a pure `readEnv(src) → { AUTH_URL, DATA_API_URL }` used by the constants and by tests.

- [ ] **Step 1: Failing test** `src/env.test.js`:
  - `readEnv({ NEXT_PUBLIC_NEON_AUTH_URL: 'https://a', NEXT_PUBLIC_NEON_DATA_API_URL: 'https://d' })` equals `{ AUTH_URL: 'https://a', DATA_API_URL: 'https://d' }`;
  - `readEnv({})` equals `{ AUTH_URL: '', DATA_API_URL: '' }`.
- [ ] **Step 2:** `npx vitest run src/env.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `src/env.js`.** Replace the 3 `import.meta.env.VITE_…` reads in supabase.js, authApi.js and Login.jsx with imports from `./env`, keeping the same expressions around them.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5: Dependencies.**
  - `npm install next@16.4.3`;
  - `npm install -D @tailwindcss/postcss` (same major as `tailwindcss`);
  - keep `vite`, `vitest`, `@vitejs/plugin-react` as devDependencies, and remove `@tailwindcss/vite`;
  - scripts: `"dev": "next dev -p 5175"`, `"build": "next build"`, `"start": "next start"`, `"test": "vitest run"`, `"test:watch": "vitest"`.
- [ ] **Step 6: Config.**
  - `postcss.config.mjs`: `{ plugins: { '@tailwindcss/postcss': {} } }`.
  - `vitest.config.js`: `defineConfig({ plugins: [react()], test: { include: ['src/**/*.test.{js,jsx}', 'server/**/*.test.js'] } })`.
  - `next.config.mjs`: `{ reactStrictMode: true }`. Add only what Task 4 proves necessary.
  - `.gitignore`: add `.next/` and `next-env.d.ts`.
- [ ] **Step 7: `app/layout.jsx`** (server component): `<html lang="en"><head>…</head><body>{children}</body></html>`, reproducing `index.html`'s head exactly:
  - charset, the viewport meta with `viewport-fit=cover`;
  - title "BiteMark", description, theme-color `#f3ead8`;
  - icon `/icon.svg`, apple-touch-icon, manifest `/manifest.webmanifest`;
  - the two preconnects using the `NEXT_PUBLIC_` values (omitted when empty);
  - the fonts.googleapis / gstatic preconnects and the Figtree stylesheet link (same URL);
  - `mobile-web-app-capable`, the `apple-mobile-web-app-*` metas.

  Use plain `<meta>`/`<link>` tags in `<head>` (or the Metadata API where it produces identical tags). Import `../src/index.css`. The body has no extra wrapper that changes layout.
- [ ] **Step 8: `app/ClientApp.jsx`** (`'use client'`):
  - `const App = dynamic(() => import('../src/App.jsx'), { ssr: false })`;
  - renders `<ErrorBoundary><App/><DialogHost/></ErrorBoundary>`, the same as main.jsx;
  - a `useEffect` registers `/sw.js` when `'serviceWorker' in navigator`.

  `app/[[...path]]/page.jsx` renders `<ClientApp/>`. Delete `src/main.jsx` and `index.html`.
- [ ] **Step 9: Verify.**
  - `npx vitest run`: all pass.
  - `npm run dev`, then Playwright at http://localhost:5175:
    - the login page renders identically to the baseline (same screenshot framing);
    - Try the demo opens the journal;
    - `/share?text=…` shows the share sheet;
    - `/reset-password` shows its page;
    - an unknown path `/foo` shows the app;
    - DevTools Application shows the manifest and the `/sw.js` registration;
    - no console errors.
- [ ] **Step 10: Commit** (Kandarp): `feat(next): Next.js shell hosting the existing app`.

### Task 3: API routes

**Files:**
- Create: `server/authLookup.js`, `server/mapsResolve.js` (logic moved verbatim from `api/`), `server/nodeAdapter.js`, `server/nodeAdapter.test.js`, `app/api/auth-lookup/route.js`, `app/api/maps-resolve/route.js`
- Move: `api/maps-resolve.test.js` → `server/mapsResolve.test.js` (imports updated)
- Delete: `api/`, `vercel.json`

**Interfaces:**
- Consumes: the existing `handler(req, res)` default exports (`req.query`, `res.setHeader`, `res.status(n).json(body)`).
- Produces:
  - `toRouteHandler(handler) → (request: Request) => Promise<Response>` in `server/nodeAdapter.js`. It builds `req.query` from the URL search params, and a `res` that collects headers, status (default 200) and the JSON body, returning `new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...collected } })`.
  - The routes: `export const GET = toRouteHandler(handler)`, `export const dynamic = 'force-dynamic'`, `export const runtime = 'nodejs'`.

- [ ] **Step 1: Failing tests** `server/nodeAdapter.test.js`:
  - a handler doing `res.setHeader('Cache-Control','no-store'); res.status(200).json({ ok: true, q: req.query.x })`, called with `new Request('http://h/api/t?x=1')`, gives status 200, a JSON body `{ ok: true, q: '1' }`, the `cache-control` header `no-store`, and a content-type containing `application/json`;
  - `res.status(400).json({ error: 'Missing parameter' })` gives status 400 with that body;
  - a handler that calls `res.json(...)` without `status` gives 200.
- [ ] **Step 2:** `npx vitest run server`. Expected: FAIL.
- [ ] **Step 3:** Implement the adapter. Move the logic files and the test.
- [ ] **Step 4:** `npx vitest run`. Expected: all pass, including `mapsResolve.test.js`.
- [ ] **Step 5:** Playwright or fetch against `next dev` (with `.env` loaded by Next; never print it):
  - `/api/auth-lookup?ping=1` → `{ ok: true }`;
  - `/api/auth-lookup` → 400 `{ error: 'Missing parameter' }`;
  - `/api/maps-resolve?url=https://example.com` → 400 with the same error text as before;
  - logging in with a **username** (Demo) still works.
- [ ] **Step 6: Commit** (Kandarp): `feat(next): API route handlers`.

### Task 4: Production build and heavy client libraries

**Files:**
- Modify: `next.config.mjs` (only proven needs), and any library import that breaks under Next's bundler (keep the dynamic `import()`s)
- Delete: `dist/` (tracked; Kandarp commits the removal)

- [ ] **Step 1:** `npx next build`. Expected: success. Record the First Load JS of `/[[...path]]` and the chunk list.
- [ ] **Step 2:** `npx next start -p 5176`, then Playwright on the demo account:
  - **Craving chat:** smart matching loads (transformers.js);
  - **bill scan:** upload `public/demo/*` or any test bill image and see dishes extracted (tesseract.js);
  - **Near me Map:** clusters (markercluster needs `window.L`), heatmap (leaflet.heat), route, full screen;
  - **voice:** the "Say it" button appears where it did before.

  Fix only what breaks, with the smallest change. Note each fix as a ruling in the report.
- [ ] **Step 3:** Compare the first-load size with the baseline (within +10 %). Delete `dist/`.
- [ ] **Step 4: Commit** (Kandarp): `chore(next): production build verified; remove Vite dist`.

### Task 5: Full before/after walkthrough, docs, Vercel notes

**Files:**
- Create: `<scratchpad>/after/` (screenshots and `after.md`, outside the repo)
- Modify: `docs/frontend.md`, `docs/backend.md`, `CLAUDE.md` (stack line: "Next.js (single-page mode) + Tailwind 4", plus the dev command)

- [ ] **Step 1:** Repeat every state of Task 1's `baseline.md` on `next start` (production build), with the same widths and themes. Compare each pair visually. List any difference, then fix it or rule on it (only pixel noise such as times or map tiles is acceptable).
- [ ] **Step 2:** Run the 13-feature Near me checklist and the regression items (login labels, distance ring, Fatehganj placement) on Next.
- [ ] **Step 3: Docs.**
  - **frontend.md:** a "Next.js migration (single-page mode)" entry covering structure, the dev/build commands, the env names, what changed and what didn't, and that phase B (routes) is the next step.
  - **backend.md:** the API routes now in `app/api/*` with the logic in `server/`; Vercel steps:
    - Framework Preset Next.js;
    - add `NEXT_PUBLIC_NEON_AUTH_URL` and `NEXT_PUBLIC_NEON_DATA_API_URL`, same values as `VITE_…`;
    - keep `DATABASE_URL`;
    - add the preview domain to Neon Auth trusted domains;
    - delete the `VITE_…` variables after the merge.
- [ ] **Step 4:** The final run: `npx vitest run` passes everywhere, and `npx next build` succeeds.
- [ ] **Step 5: Commit** (Kandarp): `docs(next): migration notes`.
