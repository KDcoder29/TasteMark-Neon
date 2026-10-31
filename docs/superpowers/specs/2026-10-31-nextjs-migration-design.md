# Move BiteMark from Vite to Next.js (design)

Date: 2026-10-31 · Branch: `BiteMark/NextJS` (cut from released `main` a91a8c0) · Status: for approval

## Intent

Kandarp wants the whole project on Next.js, hosted on the same Vercel project. His conditions:

- every module and feature keeps working;
- the UI stays exactly the same.

When it's done he merges the branch into `main` himself.

## Goals

- BiteMark builds and runs as a Next.js app (`next dev` / `next build`), deployed on the same Vercel project and URL.
- Every screen, feature, animation and theme looks and behaves as it does today:
  - phone and desktop, light and dark;
  - the installable app (manifest, service worker), the share target (`/share`) and password reset (`/reset-password`).
- The two server functions (`/api/auth-lookup`, `/api/maps-resolve`) keep the same URLs, inputs and outputs.
- All 425 tests keep passing, and the main bundle stays about the same size.

## Non-goals and anti-goals

- No redesign, no new features, no copy changes.
- No server-side rendering of the journal in this move. That would change how screens load and can't promise the same UI. It can be a later step.
- No new paid services and no database changes.
- Failure even if everything technically builds:
  - any screen that looks or acts differently;
  - a broken offline or installed-app start;
  - a slower first open.

## Findings from the code (what ties the app to Vite today)

- One entry: `index.html` + `src/main.jsx` mounts `<App/>` (with `ErrorBoundary`, `DialogHost` and service-worker registration).
- The app does its own routing from `window.location.pathname` (`/share`, `/reset-password`, otherwise the app).
- **Environment:** 2 browser variables, `VITE_NEON_AUTH_URL` and `VITE_NEON_DATA_API_URL`, used in `supabase.js`, `authApi.js` and `Login.jsx`, plus `%VITE_…%` preconnect links in `index.html`. The server functions read `DATABASE_URL` (server-only).
- **`api/*.js`:** Vercel Node functions with the `(req, res)` style. `vite.config.js` runs them in dev through a small plugin.
- **`vercel.json`:** a single rewrite of every non-file path to `index.html`.
- Heavy libraries are already loaded on demand with dynamic `import()`: Leaflet and its plugins, transformers.js and tesseract.js. There are no Vite-only imports (`?url`, `?worker`) in the app.
- Tests: Vitest (39 files). One test reads a file through `import.meta.url`.

## The approach (my call): Next.js App Router, as a single-page app

The supported Next.js pattern for an app like this ("single-page application" mode):

1. **`app/layout.jsx`:** the same `<head>` as `index.html`, including:
   - title, description, theme colour;
   - icons, manifest, Figtree font links;
   - the iOS web-app meta tags;
   - the two preconnect links, now from `NEXT_PUBLIC_…` variables.

   It imports `src/index.css`.
2. **`app/[[...path]]/page.jsx`:** one catch-all page. It renders a client component that loads today's `<App/>` in the browser only (`dynamic(…, { ssr: false })`), wrapped exactly as `main.jsx` does, and registers the service worker. Every path (`/`, `/share`, `/reset-password`) reaches the same app, which keeps routing itself as today. So `vercel.json` is no longer needed.
3. **`src/` stays where it is.** Components, CSS and logic are untouched except:
   - the 3 places that read environment variables (moved to one small `src/env.js` that reads `process.env.NEXT_PUBLIC_…`);
   - `main.jsx` and `index.html`, which are replaced by the files above.
4. **Server functions:** `app/api/auth-lookup/route.js` and `app/api/maps-resolve/route.js`.
   - Each is a thin adapter from Next's `Request` to the existing handler logic.
   - The URLs, query parameters and JSON stay identical, and so does `Cache-Control: no-store`.
   - The logic stays testable, so `maps-resolve.test.js` keeps passing.
   - `api/` and the Vite dev plugin go away.
5. **Tailwind 4:** switches from `@tailwindcss/vite` to `@tailwindcss/postcss` (the same Tailwind with the same CSS).
6. **`public/`:** manifest, `sw.js`, icons and demo assets are unchanged. The share target keeps pointing at `/share`.
7. **Tests:** Vitest stays, with its own small `vitest.config.js`. Vite remains only as the test runner's engine.
8. **Next config:**
   - `reactStrictMode: true` (same as today);
   - any settings needed so transformers.js and tesseract.js keep loading in the browser exactly as now (the builder verifies);
   - no `output: 'export'`, so the API routes work on Vercel.

## Vercel

- Same project. Vercel detects Next.js by itself. Kandarp:
  - sets the Framework Preset to Next.js if it isn't detected;
  - adds `NEXT_PUBLIC_NEON_AUTH_URL` and `NEXT_PUBLIC_NEON_DATA_API_URL` with the same values as the `VITE_…` ones (keep the old ones until the merge);
  - keeps `DATABASE_URL`.
- The branch's preview deployment is the full check before the merge.
- **Neon Auth trusted domains:** the preview URL may need adding, as before.

## How "nothing is hindered" is proven

- All unit tests pass, and `next build` succeeds.
- A Playwright walkthrough on the demo account, before (current `main`) and after (this branch), at 390 px and 1280 px, light and dark, with side-by-side screenshots of each screen. It covers:
  - login, Try the demo, sign-up form, forgot password;
  - journal list, search, filters, sort, place detail, edit, delete/undo, Send picture;
  - add a place by hand, Say it, and bill scan;
  - Want to try, We went;
  - groups (create/join UI), activity;
  - Craving, Where to eat;
  - You tab and food story, dark mode, tour and Feature guide;
  - Near me: all 13 map features from the previous checklist;
  - `/share` and `/reset-password` paths;
  - manifest and service worker present (installable), and the offline message for Near me;
  - both `/api` endpoints.
- First-load size compared before and after.

## Constraints

- Kandarp's standing rules:
  - no git state changes by Claude beyond cutting the branch;
  - one question at a time in chat;
  - TDD for logic changes;
  - Playwright for checks;
  - FE and BE docs updated;
  - themed UI only;
  - no `foo.js` next to `Foo.jsx`.
- `dist/` is tracked today. With Next.js, the build goes to `.next/`, which is git-ignored. `dist/` can be removed from the repo in this branch (Kandarp commits that).

## Decided by Kandarp

- Move to Next.js, same Vercel hosting, branch from the released `main`, he merges when done.
- No feature may break; the UI stays the same.

## My calls (please check)

- **Single-page mode:** the app runs entirely in the browser, as today. No server rendering, because that's the only way to guarantee an identical UI and behaviour.
- **One catch-all page** instead of a separate Next.js route per screen. The app's own navigation is kept.
- `src/` stays in place; only the entry, the environment reads and the API wrappers change.
- `dist/` and `vercel.json` are removed.

## Left to the builder

- The exact Next.js version: latest stable that supports React 19.
- The specific Next config flags the heavy libraries need.
- The shape of the API adapter.
- The details of the before/after screenshot method.
