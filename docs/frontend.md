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
- **2026-10-26 — Capture a bill** (branch `BiteMark/Bill_Capture`). The user handed the design to Claude. It builds on the bill scan below.
  - **Two actions in the scan tile.**
    - **Take photo**: `<input capture="environment">` opens the phone's own rear camera. That gives better focus, flash and HDR than an in-app `getUserMedia` camera, and works in iOS PWAs.
    - **Upload**: a plain input that opens the gallery or a file.
    - Take photo is shown only when `matchMedia('(pointer: coarse)')` is true (`src/capture.js` → `canTakePhoto`). Laptops get a single "Upload bill photo", because a webcam is useless for bills and `capture` is ignored there anyway.
  - **Review against the photo.** After a scan, a thumbnail and a "View bill" link open a full-screen viewer with Zoom in / Fit to screen; Esc or a tap outside closes it.
    - The photo is an object URL that is revoked on unmount. It is never uploaded or stored.
    - The viewer is rendered with `createPortal` into `<body>`. Inside the form, the `.sheet` transform animation made `position: fixed` form-sized and drew the form's fields over the photo. This was found with Playwright and fixed.
  - **Long bills in parts.** The tile turns into "Add more from the bill". `newScannedDishes` (in `placeRules.js`) skips dishes whose name is already in the list (ignoring case and spaces) or is repeated within the same scan. If nothing is new, the message says "Those dishes are already in the list."
  - `BillScan` calls the form's latest `onDishes` through a ref. OCR takes a few seconds, and an older handler would have overwritten rows typed during that time.
  - The parent's `onDishes` now returns the number of dishes it added; the message uses that count.
- **2026-10-25 — Bill scan in the "Add place" window** (branch `BiteMark/Bill_Scan`).
  - **What it does.** A "Scan a bill" tile sits above the dish rows. A photo, from the camera or the gallery, fills in **only the dish name and price** for each line found on the bill.
    - If the form has only the empty starter row, the scanned rows replace it. Rows you already typed are kept.
    - You then add stars and a comment yourself and press Save.
  - **Free, on-device OCR (user's requirement: no per-scan cost).** Tesseract.js v6 reads the photo in the browser.
    - It is loaded with a dynamic `import()`, so it is a separate small chunk and only downloads when someone scans.
    - The worker and the English language data come from the jsDelivr CDN. The browser caches them after the first scan.
    - Paid options were rejected by the user: Claude vision and Google Vision.
  - **Photo clean-up before OCR** (`billOcr.js`):
    - The photo is resized so its long side is 1600–2400 px.
    - It is converted to grayscale and the contrast is stretched. The darkest 1% becomes black and the brightest 1% white.
  - **Page layout mode = 6** ("single uniform block"). This was measured on the fixture `e2e/fixtures/bill.jpg`. Mode 6 reads 4 of 4 dishes. Mode 4 reads 2 of 4 because it splits the right-hand price column off. Modes 3 and 11 read none.
  - **Parsing rules** (`billParse.js`, unit-tested). A dish line is "words, then numbers at the end".
    - Lines are skipped if they contain GST, CGST/SGST, tax, service, charges, discount, round off, total, amount, bill, table, date, phone and similar words.
    - Price per item:
      - 3 numbers → the middle one (qty, rate, amount).
      - 2 numbers → if the first is a whole number from 1 to 10, it is the quantity and price = amount ÷ qty. Otherwise the first number is the rate.
      - "2 x Name 60" → 60 ÷ 2.
    - "₹", "Rs" and thousands commas are handled. Paise are rounded to the nearest rupee.
    - ALL-CAPS names are converted to Title Case, and the first letter is always capitalised.
    - English text only. Gujarati or Hindi script is not read.
  - **Stars AND comment are now required on every dish** in the Add/Edit place window, not only scanned dishes (user decision). The placeholder is now "Your comment *".
    - Editing an old place whose dishes have no comment will ask for one.
    - Group "Add a dish" (`DishForm.jsx`) is unchanged; its note is still optional.
  - **Form rules moved out of the UI.** `blankDish`, `mergeScannedDishes` and `placeFormError` now live in `src/placeRules.js` so they can be tested.
  - **File naming on Windows.** The parser is `billParse.js`, not `billScan.js`. Windows treats file names case-insensitively, so `./BillScan` resolved to `billScan.js` instead of `BillScan.jsx` and broke the build.
  - **Not in scope for v1:** the group "Add a dish" window, filling place name or city from the bill, and storing the photo.
- **(existing, Maps branch, uncommitted)** The map shows the list that Journal has *already filtered*, so the map and the list always match.
  - Tiles are plain OSM, because CARTO now needs an API key. The map therefore stays light even in dark mode.
  - The place form re-geocodes only when area or city changes.

## Open items / known issues (noticed during onboarding, not yet fixed)
- `MapView.jsx`: the marker effect depends on `pinned` and `wishPinned`. Both arrays are rebuilt on every render, so the effect re-runs and calls `fitBounds` each time. Any re-render (for example the "Locating…" state) can reset the user's pan/zoom. Fix by wrapping the arrays in `useMemo`.
- **Testing.**
  - `npm test` runs Vitest 5 (`*.test.js` next to the source files). Write tests first.
  - UI checks use the Playwright MCP against `npm run dev`. The MCP can only read files inside the repo, so fixtures live in `e2e/fixtures/`. Scratch output goes to `.playwright-mcp/`, which is gitignored.
  - **`.npmrc` sets `legacy-peer-deps=true`. Do not remove it.** Root-caused on 2026-10-26 after Vercel's `npm install` failed with "Cannot read properties of null (reading 'children')".
    - `@neondatabase/neon-js` → `@neondatabase/auth` → `better-auth@1.7.6` declares `vitest` as a peer dependency.
    - With any vitest installed, npm's `#loadPeerSet` crashes on a clean install. Both Vitest 3 and Vitest 5 crash, with or without a lockfile.
    - Bisected: removing `@neondatabase/neon-js` or `vitest` makes the install succeed.
    - With the `.npmrc`, `npm ci`, the tests, the build and a browser load of the built app were all verified. The lockfile is unchanged.
    - If a later neon-js or better-auth release drops the vitest peer, test removing the `.npmrc` with a clean `npm ci`.
  - The production build warns that the main chunk is 693 KB. That size was already there before this change.

## Branches
- `origin/main` is the main branch. Every task gets a feature branch cut from `origin/main` with `git switch --no-track -c BiteMark/<Name> origin/main`. Claude may create the branch; the user commits and pushes.
  - Without `--no-track`, a plain `git push` goes to main. That is how the bill scan landed: commit b12d64c went directly into `main` on 2026-10-25.
- `BiteMark/Maps_feature`: the Map tab, Leaflet and geocoding (commit 594a41f). Marked "not accurate, not to be merged with main". `MapView.jsx` and `geocode.js` do not exist on other branches.
- `BiteMark/Bill_Scan`: bill photo → prefilled dish form (in progress).

## Session log
- 2026-10-25: Onboarding session. Read the codebase and started these docs. No code changes yet.
- 2026-10-25: **Bill scan built on `BiteMark/Bill_Scan`.** Not committed; the user commits.
  - 31 unit tests pass and `vite build` passes.
  - Playwright run on a 390 px phone viewport, logged in by the user. Add place → scan `e2e/fixtures/bill.jpg` → 4 dishes filled with name and price only.
    - Save was blocked until every dish had a comment and stars.
    - After review, Save stored all 4 dishes with the correct prices, stars and comments.
    - The test place "ZZ Bill Scan Test" was then deleted, and the journal was back to 44 places.
  - **Watch out:** `dist/` is tracked in git, and running `vite build` rewrites it. Restore it before committing unless a new build is wanted.
  - **Tip:** to verify a build without touching the tracked `dist/`, run `npx vite build --outDir <scratch dir> --emptyOutDir`. This was used from 2026-10-26.
  - **Next ideas (not agreed):** scan in the group "Add a dish" window; read the place name from the bill header; test more real bill photos from the user and add their text as parser test cases.
- 2026-10-26: **Capture a bill built on `BiteMark/Bill_Capture`** (created with `--no-track`). Not committed.
  - 37 unit tests pass and the build passes.
  - Playwright at 390 px with a touch screen emulated through a `matchMedia` override:
    - Take photo and Upload are both shown, and the camera input asks for the rear camera.
    - A captured bill added 4 dishes, and a row typed while it was reading survived.
    - Re-scanning added nothing.
    - The viewer covers the full screen and sits on top of the form; zoom works and Esc closes it.
  - Desktop at 1280 px shows only "Upload bill photo".
  - No database writes this time. The save path is unchanged from the bill scan run, which was already verified.
