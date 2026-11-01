# BiteMark on real Next.js routes and the standard folder structure (design)

Date: 2026-10-31 · Branch: `BiteMark/NextRoutes` (cut from released `main` 4fbcac8) · Status: for approval

## Intent

Phase B after the move to Next.js (phase A ran the old single-page app inside one Next.js page). Kandarp wants:

- every screen on its own Next.js route;
- the project in Next.js's standard folder structure;
- multiple agents may do the work.

Why: refresh and Back should behave like a real app, links should work, and the first open should be lighter. Today one big bundle loads everything, which "was taking time". It also gives a clean base for about 9 more screens planned later.

## Goals

- **Addresses:**

  | Address | Screen |
  |---|---|
  | `/` | Places (Personal journal) |
  | `/want-to-try` | Want to try |
  | `/near` | Near me |
  | `/places/[placeId]` | Place details |
  | `/g/[groupId]` | Places in a group |
  | `/g/[groupId]/want-to-try` | Want to try in a group |
  | `/g/[groupId]/near` | Near me in a group |
  | `/g/[groupId]/activity` | Group activity |
  | `/g/[groupId]/places/[placeId]` | Place details in a group |
  | `/groups` | Create, join and manage groups (opens the same sheet as today) |
  | `/you` | Account and food story (opens the same sheet as today) |
  | `/login` | Login, sign-up, forgot password |
  | `/reset-password` | Choose a new password |
  | `/share` | Share from Google Maps |

- **Place details (Kandarp chose option A):**
  - Tapping a place opens the same bottom sheet / side drawer over the list, and the address changes to `/places/[id]`.
  - Back closes it; refresh or a shared link opens that place.
  - This uses Next.js intercepting + parallel routes (`@modal`, `(.)places/[placeId]`). When opened directly, the same sheet shows over the space's Places list, so it looks the same either way.
  - `/groups` and `/you` work the same way: today's sheets, now with an address (and Back closes them).
- **Behaviour:**
  - Refresh keeps the current screen.
  - The phone/browser Back button moves between screens and closes the place sheet.
  - Each screen's code is split per route, so the first open downloads less than today.
- **The UI and behaviour stay identical** on phone and desktop, in light and dark: same components, styles, animations, gestures and sheets.
  - The sidebar and bottom bar become shared layouts.
  - The bottom-bar / sidebar buttons become links but look and feel the same.
- **Overlays without addresses stay as they are:**
  - add/edit place form, the + menu, Craving, Where to eat, filter sheet;
  - tour, Feature guide, demo video, change password;
  - the share-target sheet, Fix locations, demo welcome.

## Non-goals / anti-goals

- No visual redesign, no copy changes, no new features.
- No server-side data fetching. Neon Auth's session lives in the browser (neon-js), so screens stay client components, and the data loading keeps working exactly as now: the instant "fast start" snapshot, background refresh, the auto-locate queue.
- No database or API changes.
- **Failure even if it builds:**
  - any screen that looks or acts differently;
  - data loaded twice when moving between Places, Want to try and Near me (they share one load per space, as today);
  - losing the fast start;
  - a slower first open than today's Next.js build;
  - a broken `/share` or `/reset-password`.

## Current structure (findings)

- **`src/App.jsx` (531 lines):** session, groups, the current space (Personal or a group, kept in localStorage), the `view` state (`journal | wishlist | near | activity`), the + menu, sheets (spaces, you, account, groups, password, help), the demo flow, share handling, and the theme.
- **`src/Journal.jsx` (452 lines):** loads places, wishlist and names for the space (with the fast-start snapshot). It owns:
  - open place (`openId`), create/edit form;
  - filters, search, sort;
  - Craving/Picker opening, Fix locations, the auto-locate listener;
  - rendering of the four views.
- About 80 other files: components (`*.jsx`) and pure logic (`*.js`), with tests next to them.
- `app/` holds the phase-A shell: `layout.jsx`, `page.jsx`, `ClientApp.jsx` and `AppShell.jsx`.

## The design

### Folder structure (Next.js standard, with an `@/` import alias)

```
app/
  layout.jsx                       root <html>/<head> (as now), globals.css
  (auth)/login/page.jsx            logged-out pages; no app shell
  (auth)/reset-password/page.jsx
  share/page.jsx                   stashes the share, then sends you on (login or the app)
  (app)/layout.jsx                 client shell: session gate → /login, sidebar + bottom bar, sheets, providers
  (app)/@modal/default.jsx         nothing
  (app)/@modal/(.)places/[placeId]/page.jsx       place sheet over the list
  (app)/(personal)/layout.jsx      Personal space data provider
  (app)/(personal)/page.jsx        Places
  (app)/(personal)/want-to-try/page.jsx
  (app)/(personal)/near/page.jsx
  (app)/(personal)/places/[placeId]/page.jsx      full-page place (direct link / refresh)
  (app)/g/[groupId]/layout.jsx     group space data provider
  (app)/g/[groupId]/page.jsx, want-to-try/, near/, activity/, places/[placeId]/
  (app)/@modal/(.)groups/page.jsx, (app)/@modal/(.)you/page.jsx    today's sheets, with an address
  (app)/groups/page.jsx, (app)/you/page.jsx                         direct link: the sheet over Places
  api/…                            unchanged
components/   all UI components (from src/*.jsx), grouped: layout/, journal/, place/, map/, groups/, tour/, auth/, ui/
lib/          all pure logic (from src/*.js) with their *.test.js beside them
hooks/        React hooks (useGestures, layers, locationReady, ...)
styles/globals.css   (from src/index.css)
server/       unchanged
public/       unchanged
```

- The exact folder each file lands in is the builder's call within this layout.
- `src/` disappears.
- Imports use `@/components/…`, `@/lib/…` via `jsconfig.json`.

### State and data

- **`AppProvider`** (in `(app)/layout.jsx`): session, profile and username, groups, theme, the help overlays, and the + menu and add intent (lifted from App.jsx).
- **`SpaceProvider`** (in each space layout): the Journal's data (places, wishlist, names, loading, fast start, reload, auto-locate) for that space.
  - It is shared by Places, Want to try, Near me, Activity and the place sheet in that space, so moving between them doesn't reload.
  - The space now comes from the URL (`/` = Personal, `/g/[id]` = that group). The last-used space is still remembered, so opening `/` after last using a group goes to that group, as the app does today.
- **Navigation:**
  - `go(view)` and `setOpenId(id)` become `router.push(...)`, and closing a place sheet becomes `router.back()`.
  - The sidebar and bottom bar use `<Link>` (prefetch on) with the same markup.
- **Login gate:**
  - no session → `/login`;
  - a session on `/login` → `/`;
  - the demo and Try-the-demo flows are unchanged.

## Constraints

- **Next.js 16.4.3:** read `node_modules/next/dist/docs/` (parallel and intercepting routes, layouts, `useRouter`, `Link`, `jsconfig` paths) before using an API.
- **Kandarp's rules:**
  - no git state changes by agents;
  - TDD for logic;
  - Playwright for checks;
  - themed UI only;
  - no `foo.js` next to `Foo.jsx` (also across the new folders when imports are case-insensitive);
  - preserve CRLF;
  - update `docs/frontend.md` and `docs/backend.md`.
- All tests must keep passing after moving into `lib/` and `components/`.
- **Proof:**
  - **UI:** the 72-screenshot before/after comparison (baseline: today's production build). Pages reached by URL, plus Back/refresh checks for every route, phone and desktop.
  - **Behaviour:** the 13 map features; `/share`; `/reset-password`; demo; bill scan; Craving.
  - **Size:** first-load JS per route and cold/warm load times vs today's Next.js build (must not be slower).

## Decided by Kandarp

- Option B (real routes), after phase A was merged.
- Place details get their own address (option A of the modal question).
- Multiple agents may work on it.

## My calls (please check)

- `/g/[groupId]/…` for group spaces; Personal at the root.
- `/groups` and `/you` keep today's sheets (no new page design) and gain an address. On desktop the account dropdown stays a dropdown with no address, because it's a tiny menu.
- Short-lived actions (add/edit, Craving, Where to eat, filters, tour, password) stay overlays without addresses.
- `src/` is split into `components/`, `lib/`, `hooks/`, `styles/`.
- `/share` becomes its own small page that stashes the share and redirects.
