# BiteMark — Frontend scope

Everything in the browser: React components, styling, client-side logic (search, craving chat, picker), the PWA shell, and the map.

> Update this file whenever a frontend decision is made or a task finishes. Newest decision log entries go first.

## Product in one paragraph
BiteMark ("Remember every great bite") is a personal food journal PWA, used mainly in Gujarat (Vadodara, Ahmedabad). You log a **place**, then its **dishes**. Each dish has a price in ₹, a 1–5★ rating, an order-again flag (yes/maybe/no) and a note. Notes are often in Gujarati or Hindi slang ("ekdum mast", "tikhu"). Places can be personal or shared into **groups**. In a group, ratings are averaged across members, and there are reactions, comments and an activity feed. Other features: a wishlist of places you want to try, a random "Where to eat?" picker, a "Craving something?" chat, and a Map tab (in progress).

## Stack & conventions
- React 19, Vite 8, Tailwind 4 (`@tailwindcss/vite`). Plain JSX, no TypeScript, no router.
  - The `/reset-password` path is checked by hand in `App.jsx`.
- Theme tokens are CSS variables in `src/index.css`. Light values are on `:root`, dark values on `:root[data-theme="dark"]`. Use the tokens: `--bg`, `--surface`, `--ink`, `--mute`, `--line`, `--pri`, `--ok`, `--bad`, `--star`, and so on.
- Utility classes: `.input`, `.chip`/`.chip.on`, `.pill`, `.fab`, `.menu`, `.menu-item`, `.switch`, `.skel`. Animations: `.rise`, `.fade`, `.sheet`.
- Code style: short comments that explain *why*, compact one-line handlers, inline `style={{ color: 'var(--mute)' }}` for colours.
- `localStorage` holds UI preferences only: `theme`, `space`, `sort`. Every access is wrapped in try/catch.
- `public/sw.js` is a minimal service worker. It exists only so the app can be installed. There is no offline cache.

## Component map
| File | Role |
|---|---|
| `App.jsx` | Auth session, theme, header, space switcher (Personal / each group). Polls group membership every 15s. |
| `Journal.jsx` | Main screen. Loads places and wishlist, filters/sorts them, shows the tabs: Journal / Map / Wishlist / Activity (groups only). |
| `PlaceForm.jsx`, `DishForm.jsx` | Add/edit a place with its dishes. In groups, add a dish together with your own rating. |
| `ShareDish.jsx`, `groupApi.js` | Copy a personal dish into a group. A group has one card per place (matched by name + city), and your rating is added to it. |
| `GroupDish.jsx` | A dish inside a group: average rating, your rating, reactions, comments. |
| `Wishlist.jsx`, `Activity.jsx`, `Picker.jsx`, `CravingChat.jsx` (+`craving.js`) | The features with the same names. |
| `search.js` | Fuzzy search with scores: exact match, prefix, synonym groups (including Gujarati/Hindi words), substring, typo tolerance. |
| `MapView.jsx`, `geocode.js` | Leaflet map with OSM tiles. Pin colour comes from the best rating. "Near me" lists the nearest places. |
| `Login.jsx`, `ResetPassword.jsx`, `ChangePassword.jsx`, `authApi.js` | Login with username or email, sign-up, password reset and change. |

## Decision log
- **(existing, Maps branch, uncommitted)** The map shows the list that Journal has *already filtered*, so the map and the list always match.
  - Tiles are plain OSM, because CARTO now needs an API key. The map therefore stays light even in dark mode.
  - The place form re-geocodes only when area or city changes.

## Open items / known issues (noticed during onboarding, not yet fixed)
- `MapView.jsx`: the marker effect depends on `pinned` and `wishPinned`. Both arrays are rebuilt on every render, so the effect re-runs and calls `fitBounds` each time. Any re-render (for example the "Locating…" state) can reset the user's pan/zoom. Fix by wrapping the arrays in `useMemo`.
- Testing: there is no test suite. UI verification is done with Playwright MCP against `npm run dev`.

## Session log
- 2026-10-25: Onboarding session. Read the codebase and started these docs. No code changes yet.
