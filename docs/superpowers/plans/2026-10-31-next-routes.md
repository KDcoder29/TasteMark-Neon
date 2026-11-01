# Next.js Routes + Standard Folders (phase B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every BiteMark screen is a real Next.js route in the standard folder structure, with the UI and behaviour unchanged.

**Architecture:**
- `src/` is split into `components/`, `lib/`, `hooks/` and `styles/`, imported via `@/`.
- `app/(app)/layout.jsx` is the client shell. It holds the session gate, the sidebar and bottom bar, the app-wide sheets, and `AppProvider` (lifted from `src/App.jsx`).
- Each space has a layout with `SpaceProvider`: today's `Journal` data and overlays (lifted from `src/Journal.jsx`). Its view pages (`page.jsx`, `want-to-try`, `near`, `activity`) render only their view, so each view's code is split per route and the data loads once per space.
- Place details, `/groups` and `/you` use the `@modal` parallel slot with intercepting routes, plus direct-link fallbacks.

**Tech Stack:** Next.js 16.4.3 App Router (layouts, route groups, dynamic segments, parallel and intercepting routes, `Link`, `useRouter`, `usePathname`), React 19, Tailwind 4, Vitest, Playwright MCP.

**Spec:** `docs/superpowers/specs/2026-10-31-next-routes-design.md`

## Global Constraints

- **Read the bundled docs first:** `node_modules/next/dist/docs/01-app/…`, especially parallel routes, intercepting routes, layouts, linking-and-navigating, and the `jsconfig` absolute-imports guide. This Next.js version differs from training data.
- **UI and behaviour identical** to today's build (phone 390 px and desktop 1280 px, light and dark): same components, CSS classes, animations, gestures and sheet look.
- **Data loads once per space.** Moving between Places, Want to try, Near me and Activity doesn't reload. The fast-start snapshot, background refresh, auto-locate and pull-to-refresh behave as today. Search, filter and sort state survives switching views within a space, as today.
- **No server data fetching:** route components are client components where they touch session or data. No API or database changes.
- **Addresses** exactly as the spec table:
  - `/`, `/want-to-try`, `/near`, `/places/[placeId]`;
  - `/g/[groupId]` plus `/want-to-try`, `/near`, `/activity`, `/places/[placeId]`;
  - `/groups`, `/you`, `/login`, `/reset-password`, `/share`.
- **Git:** no git state changes by agents (no add, mv, commit or stash). Use plain file moves. Kandarp commits.
- **Files:** never `foo.js` next to `Foo.jsx` in the same folder. Preserve each file's line endings.
- **Builds:** use `npx next build` (`.next/` is gitignored). Dev server: `npm run dev` (port 5175). Production checks: `npx next start -p 5176`.
- **Accounts:** Playwright uses the demo account only (Try the demo).
- **Docs:** update `docs/frontend.md` / `docs/backend.md` per task.

## Review Focus

1. **Back button:** list → place sheet → Back closes the sheet (no full reload, list scroll kept). `/near` → `/want-to-try` → Back returns to `/near` with its state.
   - Test: Task 3a and Task 4 Playwright steps.
2. **Refresh and direct links:**
   - refresh on every address shows the same screen;
   - a direct `/places/[id]` link shows the sheet over Places;
   - an unknown place id shows Places with no sheet, and nothing crashes.
   - Test: Task 3a, Task 4.
3. **Switching spaces:**
   - Personal ↔ group changes the URL prefix;
   - the last-used space is remembered for `/`;
   - a group you left or can't access (`/g/[badId]`) goes back to Personal without crashing.
   - Test: Task 2.
4. **Logged out:**
   - every app address redirects to `/login`, and after login you land back on the address you asked for;
   - `/share` while logged out is kept and shown after login;
   - Try the demo still works.
   - Test: Task 3c.
5. **No double loading:** switching views in a space fires no new places/wishlist fetch (count the Data API requests).
   - Test: Task 2.

---

### Task 1: Standard folder structure (no behaviour change)

**Files:**
- Move: every `src/*.jsx` → `components/<area>/`, every `src/*.js` (non-hook) → `lib/` with its `*.test.js`, hooks (`useGestures.js`, `layers.js`, `locationReady.js`, others that export `use*`) → `hooks/`, and `src/index.css` → `styles/globals.css`.
- Create: `jsconfig.json` (`"paths": { "@/*": ["./*"] }`).
- Modify: `vitest.config.js` (include `lib/**/*.test.js`, `components/**/*.test.{js,jsx}`, `hooks/**/*.test.js`, `server/**/*.test.js`; alias `@` → the repo root), `app/layout.jsx` (css path), `app/AppShell.jsx`, and every import.

**Interfaces:**
- Produces: the folder map, written to `docs/frontend.md` (file → new path) for later tasks.
- All imports use `@/components/…`, `@/lib/…`, `@/hooks/…`.

- [ ] **Step 1:** Write a one-off script (in the scratchpad, not the repo) that moves the files and rewrites the import specifiers, with relative paths → `@/`. Run it.
- [ ] **Step 2:** `npx vitest run`. Expected: the same number of tests as before (436), all passing.
- [ ] **Step 3:** `npx next build`. Expected: success, with route `○ /`.
- [ ] **Step 4:** Playwright (demo): log in, journal, Near me map, Craving answer. Expected: identical to before, with 0 console errors. `src/` no longer exists.
- [ ] **Step 5:** Docs (folder map). Commit (Kandarp): `refactor: Next.js standard folders`.

### Task 2: App shell, space layouts and view routes

**Files:**
- Create:
  - `lib/routes.js` + `lib/routes.test.js`
  - `components/app/AppProvider.jsx` (`useApp`), `components/journal/SpaceProvider.jsx` (`useSpace`)
  - `app/(app)/layout.jsx`, `app/(app)/@modal/default.jsx`, `app/(app)/default.jsx` if the docs require it
  - `app/(app)/(personal)/layout.jsx`, `page.jsx`, `want-to-try/page.jsx`, `near/page.jsx`
  - `app/(app)/g/[groupId]/layout.jsx`, `page.jsx`, `want-to-try/page.jsx`, `near/page.jsx`, `activity/page.jsx`
- Modify: `components/…/App.jsx` → split into AppProvider + shell markup; `components/…/Journal.jsx` → split into SpaceProvider (data, the overlays it owns, its header) + view components (PlacesView, the existing Wishlist, NearMe, Activity) rendered by the pages.
- Delete: `app/page.jsx`, `app/ClientApp.jsx`, `app/AppShell.jsx`, and the `next.config.mjs` rewrite (real routes now; keep the `env` fallback).

**Interfaces:**
- Produces (`lib/routes.js`, pure):
  - `spaceBase(groupId) → '' | '/g/' + groupId`
  - `viewHref(view, groupId) → string`: views are `'journal' | 'wishlist' | 'near' | 'activity'`, with paths `''`, `'/want-to-try'`, `'/near'`, `'/activity'`; `/` for Personal journal.
  - `placeHref(placeId, groupId) → string`
  - `parsePath(pathname) → { groupId: string | null, view, placeId: string | null, sheet: 'groups' | 'you' | null }`
- Produces (`useApp()`):
  - `{ session, me, username, groups, groupsReady, theme, setDark, help, setHelp, openAdd(intent), addIntent, clearIntent, openGroups(), openYou() }`
  - `openGroups` / `openYou` open today's sheets via state in this task. Task 3b re-points them to routes.
- Produces (`useSpace()`):
  - `{ group, places, wishlist, names, loading, netErr, reload, isOwner, canEditPlace, canEditWish, filters (q, city, cat, minRate, maxPrice, again, sort + setters), openPlace(id), closePlace(), notify(notice), … }`
  - `openPlace` opens today's PlaceDetail via state in this task. Task 3a re-points it to the route.
- Navigation: sidebar and bottom-bar items become `<Link href={viewHref(...)}>` with identical markup and classes. Space switching navigates to `spaceBase(newId) || '/'` and still stores the last space. `/` with a stored last group redirects to that group once at app start (as today's "remember the space").

- [ ] **Step 1: Failing tests** `lib/routes.test.js`:
  - `viewHref('journal', null) === '/'`
  - `viewHref('near', 'g1') === '/g/g1/near'`
  - `placeHref('p9', null) === '/places/p9'`
  - `parsePath('/g/g1/places/p9')` deep-equals `{ groupId: 'g1', view: 'journal', placeId: 'p9', sheet: null }`
  - `parsePath('/want-to-try').view === 'wishlist'`
  - `parsePath('/you').sheet === 'you'`
  - `parsePath('/unknown')` gives the journal view with nulls.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** The split described in Files. Keep JSX and classes byte-for-byte where they move. A view's page renders exactly what `Journal` rendered for that `view`.
- [ ] **Step 6:** Playwright (demo, 390 and 1280):
  - each address shows the right screen, and refresh keeps it;
  - Back between views works;
  - Review Focus 5: count the `/rest/v1/places` requests while switching views. Expected: 0 extra;
  - Review Focus 3: switching to the group and back, `/g/<random>` → Personal;
  - search text survives Places → Near me → Places.
- [ ] **Step 7:** `npx vitest run` passes, and `npx next build` succeeds, with per-route chunks (Near me code not in `/`'s first load). Docs. Commit (Kandarp): `feat(routes): app shell, spaces and view routes`.

### Task 3a: Place details route (parallel with 3b and 3c)

**Owns only:** `app/(app)/@modal/(.)places/[placeId]/page.jsx`, `app/(app)/@modal/(.)g/…/places/[placeId]` if needed per the docs' matcher rules, `app/(app)/(personal)/places/[placeId]/page.jsx`, `app/(app)/g/[groupId]/places/[placeId]/page.jsx`, and the `openPlace`/`closePlace` implementation inside `SpaceProvider`. Any other file needed → report NEEDS_CONTEXT.

**Interfaces:**
- Consumes: `placeHref`, `useSpace()`.
- Produces: `openPlace(id)` = `router.push(placeHref(id, group?.id))`; `closePlace()` = `router.back()` when the sheet was opened in-app, else `router.replace(viewHref('journal', group?.id))`.

- [ ] **Steps:**
  - The intercepted route renders today's PlaceDetail sheet over the current view.
  - The direct route renders the Places view with the same sheet open.
  - An unknown id → the Places view, no sheet.
  - Place sharing ("Send"), edit, delete and undo still work from the sheet.
  - Playwright (Review Focus 1 and 2) in both spaces, at 390 and 1280.
  - Docs.

### Task 3b: `/groups` and `/you` routes (parallel)

**Owns only:** `app/(app)/@modal/(.)groups/page.jsx`, `app/(app)/@modal/(.)you/page.jsx`, `app/(app)/groups/page.jsx`, `app/(app)/you/page.jsx`, and `openGroups`/`openYou` inside `AppProvider`.

- [ ] **Steps:**
  - Both render today's sheets unchanged; Back closes them.
  - A direct link shows the sheet over the last space's Places.
  - Joining or creating a group from `/groups` still switches into it (→ `/g/[id]`).
  - Playwright at 390 and 1280. Docs.

### Task 3c: `/login`, `/reset-password`, `/share` (parallel)

**Owns only:** `app/(auth)/login/page.jsx`, `app/(auth)/reset-password/page.jsx`, `app/share/page.jsx`, and the session gate inside `app/(app)/layout.jsx` (the redirect lines only).

**Interfaces:**
- `/share`: stashes `title`, `text` and `url` exactly like today, then `router.replace('/')` (or `/login` when logged out). The post-login take in AppProvider is unchanged.
- Logged out on an app address → `/login?next=<address>`, and after login → `next`.

- [ ] **Steps:**
  - Login, sign-up, forgot password, Try the demo and username login all as today.
  - `/reset-password?token=` as today.
  - Review Focus 4 in Playwright. Docs.

### Task 4: Proof (screenshots, URL matrix, speed)

- [ ] **Step 1:** Re-run the 72-state capture (states by their new URLs where they have one) on `next start` vs the phase-A baseline set (`scratchpad/after/` from the merged build). Expected: only data/timing differences.
- [ ] **Step 2: URL matrix.** For every address × {direct load, refresh, Back}, at 390 px, in both spaces. Record a table.
- [ ] **Step 3:** The 13 Near me features and the regression list (demo, bill scan, Craving, `/share`, the reset page).
- [ ] **Step 4: Speed.**
  - First-load JS per route from the build output.
  - Cold and warm time to the login screen and to the journal on slow 4G (same method as phase A). Expected: not slower than phase A (cold 4.78 s, warm 1.12 s).
- [ ] **Step 5:** Docs (the final structure and address map in frontend.md; CLAUDE.md structure line). Final review (most capable model).
