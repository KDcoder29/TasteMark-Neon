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
- 2026-10-26: **Bill reading state redesigned** (branch `BiteMark/Bill_Photo`, cut from `origin/BiteMark/Bill_Capture` because capture is not in `main` yet).
  - **Problem:** the user reported the loading colours looked wrong. It showed "Reading bill… 0%" with a tiny dot almost the whole time.
  - **Root cause:** Tesseract only reports progress for "recognizing text", which jumps from 1% to 63% in one go. Startup and the language-data download, about 40% of the time (much more on a phone's first scan), report nothing.
  - **Fix:**
    - The title is now "Reading your bill…", with a step line from `stageOf()` in `billOcr.js`: "Getting the reader ready", "Downloading the reader…" (shown only if it lasts more than 500 ms, so a cached reader never flashes it), then "Finding dishes and prices".
    - A `.scanbar` sliding bar in `--pri` on a 16% `--pri` tint replaces the bar. It stays still when the user has reduced motion turned on.
    - The percentage is gone. `readBillText(file, onStage)` now reports a step instead of 0..1.
- 2026-10-26: **Saved bill photos** (user decisions: shown on the place card, stored in Neon, visible to all group members).
  - `BillScan` calls `onPhoto(file)` for each photo that added at least one dish. `PlaceForm` collects them in `billFiles`, and on Save calls `saveBills(savedId, files)` from `billApi.js`.
    - Before upload, the photo is compressed by `billPhoto.js`: long side ≤ 1600 px, JPEG quality 0.7, drawn on a white background.
    - A failed bill upload alerts the user but does not undo the saved place.
  - `Journal` selects `bill_photos(id)` (ids only) and shows a **🧾 Bill** button on the card, or **🧾 N** when there are several.
  - `PlaceBills.jsx` fetches the images when the button is tapped and shows them in `BillViewer.jsx`, which was moved out of `BillScan`.
    - The viewer adds "1 of N" arrows (and ← →), a caption with place, date and "added by" in groups, and Delete when `canDeleteBill` allows it.
  - Unit tested: `billImageSize`, `canDeleteBill`. 47 tests pass and the build passes.
  - **Status:** tested end to end on 2026-10-26 (Playwright, 390 px, user's account):
    - Scan → Save uploaded the bill (HTTP 201). The card showed 🧾 Bill, and the viewer showed the image, the caption and Delete.
    - A second visit through Edit + scanning `e2e/fixtures/bill2.jpg` gave 🧾 2. The viewer showed "1 of 2", and → went to "2 of 2".
    - Deleting a bill asked for confirmation and the card went back to 🧾 Bill.
    - Deleting the place removed its bills (ON DELETE CASCADE). The database was back to 61 places, 204 dishes and 0 bills.
  - **Resilience (2026-10-26):** if the places query fails because of `bill_photos` (migration missing or stale API schema cache), `Journal.load()` retries without `bill_photos(id)`. The journal then loads without 🧾 buttons instead of showing an alert loop.
    - Reproduced first: with the stale cache, the journal showed a repeating alert.
    - Verified after the fix: it loads 44 places with no alerts.
- 2026-10-26: **Less-scrolling exploration** (user: "57 places, bored of scrolling").
  - Cause: every journal card shows every dish. The personal journal has 57 places with 3.5 dishes on average (up to 13), which is about 25 phone screens.
  - Built 3 tappable phone mockups in BiteMark's look on a private Design canvas: https://claude.ai/artifact/GLPx1Z4UobcM8SWWR7i9yV
    - (1) Compact list: one 60 px row per place (avg ★, ₹ range, dish count); tap to expand its dishes inline.
    - (2) Category shelves: "Recently added" + Food / Cafe / Dessert / Healthy as sideways-swiping rows; tap a card for a bottom sheet with its dishes.
    - (3) Tile grid: 2-column tiles with category filter chips; tap a tile for a bottom sheet.
  - **Status:** waiting for the user to pick one. Nothing is built in the app yet.
- 2026-10-26: **Full UI revamp** (branch `BiteMark/UI_Revamp`, from `origin/main` after PR #2). The user asked for a Zomato/Swiggy-quality UI: a real laptop layout and a real phone layout, clean, quick motion, a much better experience, and the bill upload near the +.
  - **Design system** (`src/index.css`, rewritten; old class names kept so every screen restyled):
    - Colours come from the logo: deep green `--pri` (#1d6b4f; dark mode #4fbf8f) for actions, links and selected chips. Saffron `--accent` (#f26b1d) only for the + button and highlights, because saffron text on white fails contrast. `--accent-ink` (#a8460c) for "Must try".
    - Rating badge tones `--great/--good/--low`. Shadows `--sh-1..3`. Motion `--ease` and `--spring`.
    - Font: **Figtree** (Google Fonts link in `index.html`).
    - Every animation and transition is cut to 1 ms when reduced motion is on.
  - **Shell** (`App.jsx`):
    - Laptop (≥1024 px): a sticky left `.sidebar` with Spaces (Personal + groups + "New or join a group"), Browse (Places with count, Want to try with count, Activity in groups), Ask BiteMark (Craving, Where to eat) and an account dropdown (dark mode, password, log out).
    - Phone: a `.topbar` (logo, space switcher sheet, theme toggle) and a `.bottomnav`: Home · Want to try · **+** (saffron, turns into ×) · Groups / Activity in a group · You (account sheet).
    - `useDesktop()` (matchMedia) is used ONLY so the + menu mounts once; everything else is responsive in CSS (`.desktop-only` / `.mobile-only`).
    - `view` is now owned by App and passed to Journal.
  - **+ menu** (`AddMenu.jsx`): Scan a bill (camera, phones only) · Upload bill photo · Add manually.
    - The bill choices are real `<label><input type=file>` elements, because phones only open the camera in direct response to a tap.
    - The picked file goes App `addIntent` → Journal → `PlaceForm initialBill` → `BillScan initialFile`, which starts reading on mount (a ref guard stops React dev mode reading it twice).
  - **Journal** (layout rewritten; data loading, smart search, filters and sorting are byte-identical):
    - Header: "Hi, <username>" or the group name, plus the place and dish counts.
    - Big `.searchbar`, pinned under the phone top bar. A chip row that scrolls sideways on phones: Sort, City, Food/Cafe/Healthy/Dessert, "4★ & up", Order again, Price (inline slider panel), Clear.
    - On phones, the Craving and Where-to-eat quick cards.
    - `.place-grid`: 1 column on phones, 2 from 640 px, 3 from 1280 px, 4 from 1680 px. The old 3★+/5★+ chips became a single "4★ & up".
  - **PlaceCard** (`PlaceCard.jsx`): a coloured monogram by category, name, `RatingBadge`, area · categories, ₹ range, dish count, bill icon, "by X" in groups, and "Must try" (or "Matches: …" while searching or filtering). Cards appear in a quick stagger.
    - Pure helpers in `placeView.js`, with tests: `placeSummary`, `placeWhere` (hides "-" placeholder areas), `ratingTone`.
    - "Must try" = an order-again dish, otherwise the best dish rated 4★+, never a low-rated one.
  - **PlaceDetail** (`PlaceDetail.jsx`): the `.drawer` is a bottom sheet on phones (grabber, 92vh) and a 520 px right panel on laptops.
    - Contents: header with badge, price and categories; Edit / Bill / + Add a dish (groups); directions; the dish list (personal rows with comment, price, stars and ↗ share; `GroupDish` in groups).
    - Esc and the backdrop close it, and the page behind doesn't scroll.
  - **PlaceForm** uses the same `.scrim` + `.drawer`.
  - **Layers:** topbar 15, bottom bar 20 (42 while the + menu is open), backdrop 40, drawer/menu 41, dialogs 45 (DishForm, ShareDish, Picker, CravingChat, Groups, ChangePassword), bill viewer 50.
  - **Verified with Playwright** at 1440×900 and 390×844 (touch emulated):
    - grid, drawer, Esc, + menu, + → Upload bill → form auto-scans 4 dishes, × closes the menu, details sheet;
    - dark mode with a group and GroupDish; Want to try.
    - No page errors. 57 tests pass and the build passes.
  - **Not redesigned yet:** the insides of Wishlist, Groups, Picker, CravingChat, Login, ShareDish, DishForm and Activity. They pick up the new colours, font and controls but keep their old layouts and emoji.
- 2026-10-26: **Revamp feedback round 1** (user liked the laptop layout and the bottom bar).
  - **No average rating on cards or in place details (user decision).** One great dish among six bad ones averages out "low", yet the place is still worth going back to.
    - Cards show `LovedTag`: "♥ N loved" (dishes rated 4★+ or marked order again). Details show "N of M loved".
    - A place with no ratings shows "Not rated". A place with ratings but nothing loved shows no tag.
    - `placeSummary().loved` is tested. `RatingBadge`, `ratingTone` and the `.rbadge` / `--great/good/low` styles were removed.
    - The "Top rated" sort still uses the average dish rating, unchanged.
  - **Phone filters redesigned** (user: "the sideways filter strip is a mess"). Follows the Zomato / Swiggy / Myntra / Airbnb pattern:
    - One row: **Filters (count badge) · Sort ▾ · Order again**. Active filters show as removable tags that wrap (no sideways scroll), plus "Clear all".
    - `FilterSheet.jsx` is a bottom sheet:
      - Section tabs on the left (Sort by, Category with per-category counts, City only if there are 2+ cities, Price, Rating, More) with an accent dot on active sections.
      - Options on the right: radios and checkboxes; Price has "Under ₹100/200/500" presets plus the slider; Rating offers Any / 4★ & up / Only 5★.
      - Footer: **Clear all** and **Show N places**. N is live.
    - The sheet edits a DRAFT; the list behind it doesn't change until Show.
    - Laptops keep the chip row unchanged (`.desktop-only`).
  - **Filtering and sorting moved to `src/journalFilter.js`:** `filterPlaces`, `sortPlaces`, `activeFilterCount`, `NO_FILTERS`, `SORTS`.
    - Characterisation tests were written first, so the move couldn't change behaviour. Journal and the sheet's live count run the same code.
  - **Verified (Playwright, 390 px):** the sheet showed 44 → Cafe 9 → Under ₹200 5 with the list unchanged behind it; Show gave 5 cards; the button read "Filters, 2 on" with Cafe × and Under ₹200 × tags; removing a tag and Clear all worked; no page errors. 67 tests pass and the build passes.
- 2026-10-26: **Revamp feedback round 2.**
  - **Laptop bug:** the Sort and City chips opened the browser's own `<select>` list, which can't be styled.
    - Replaced by `ChipSelect.jsx`: a chip plus a styled `.menu` listbox with ✓ on the current value. Keys: ↓ opens, ↑/↓ move, Enter picks, Esc closes. An outside click also closes it.
    - **Rule: never use a native `<select>` for visible app UI**, because its open list can't be styled. (The form inputs in PlaceForm and the Groups picker still use `select.input`, which is acceptable inside forms.)
  - **Phone: users got stuck inside a group.** The top-bar switcher went unnoticed.
    - The bottom bar's 4th tab is now **Personal** inside a group (one tap home) and **Groups** in Personal (opens the spaces sheet).
    - The group's **Activity** moved to a **Places | Activity** toggle (`role=tablist`) under the group name on phones. The Home tab stays highlighted for both.
    - The page heading always shows the group name inside a group.
    - The **You** tab shows your initial in a circle so it doesn't look like the Personal tab.
  - **Verified (Playwright):**
    - Laptop: the Sort menu lists 6 options; picking A to Z re-sorts; ↓↓ Enter on City picked Vadodara (37 cards); an outside click closes the menu.
    - Phone: Groups → Langotiyas shows the toggle and "Personal" in the bar; Activity shows the feed; Personal returns to "Hi, Kandarp".
    - No page errors. 67 tests pass and the build passes.
- 2026-10-26: **Smart "Craving?" chat with on-device ML** (branch `BiteMark/Smart_Craving`, from `origin/main` after PR #3).
  - **User decisions:** (1) a free AI model running on the device, PLUS a food dictionary as a booster; no paid API. (2) The index is stored on each device (IndexedDB), not in Neon.
  - **Model** (`src/embedder.js`): `@huggingface/transformers@3.8.1`, `Xenova/all-MiniLM-L6-v2` (q8, about 25 MB, downloaded once from Hugging Face; the ONNX runtime comes from the CDN).
    - Loaded with a dynamic `import()`, so it's a separate chunk of about 847 KB that downloads only when the chat opens.
    - Each dish's vector is cached in IndexedDB `bitemark-ml/vecs` under `model|textHash`, so only new or edited dishes are re-read.
    - Measured: first run 34 s (download + about 200 dishes); later opens about 2 s.
  - **Dictionary** (`src/foodLexicon.js`): 15 families (South Indian, North Indian, Gujarati, Chaat, Chinese, Italian, Fast food, Coffee, Desserts, Something cold, Spicy, Healthy, Breakfast, Snacks, Drinks), each with trigger words and dishes. Exports `expandQuery` and `topicsOfDish`.
  - **Brain** (`src/smartSearch.js`, pure and unit-tested):
    - `docsFromPlaces`: one entry per dish; its text = name, note, **its families**, place, area/city, categories; the key is an FNV hash of that text.
    - `parseCraving`: pulls out "under ₹150"-style price limits.
    - `rankDishes`: the score is the max of meaning (cosine ≥ 0.42), family (0.8, whole-word match via the `search.js` stemmer), and words (`matchScore`); then +0.04 × rating and +0.08 for order again.
    - `relatedSearches`: up to 3 found dish names plus the other families they belong to.
  - **Measured on the real journal** (this explains the tuning):
    - all-MiniLM is weak on Indian dish names: kulfi vs "sweet tooth" 0.14; lassi vs "chilled" 0.04; Diet Coke vs "sweet tooth" 0.47.
    - Adding families to the dish text lifted the right matches (lassi 0.06 → 0.37, kulfi 0.02 → 0.31, gulab jamun 0.14 → 0.39), but noise reaches about 0.37. Hence the 0.42 cut-off: the dictionary leads and the model adds only confident matches.
    - Remaining known stray: a soda for "sweet tooth".
    - Upgrade path if needed: a bigger multilingual model (about 120 MB) or a bigger dictionary.
  - **Bug found and fixed:** fuzzy prefix matching made "vada" (South Indian) match "Vadapav". The dictionary now matches whole words only (a test covers it).
  - **UI** (`CravingChat.jsx`, rewritten):
    - Same drawer as the rest of the app; a status dot (warming up / smart on / word-only fallback); starter chips.
    - Answers instantly with dictionary + words while the model loads.
    - Each result card shows why it matched ("Similar in meaning / Same food family / Matches your words"); tapping it opens that place's details (`onOpenPlace`). RELATED chips ask again.
  - `src/craving.js` was deleted (replaced). 85 tests pass, the build passes, and a clean `npm ci` with `.npmrc` works.
  - **Verified (Playwright, real model):** "south indian" → only the dosas and paniyaram at 22 Parallel (Vadapav excluded after the fix); "something chilled to beat the heat" → lassi, kulfi, ice creams, shake; "sweet tooth under 150" → desserts under ₹150; tapping a result opened its place; a related chip asked again.
- 2026-10-26: **Craving AI now prepares in the background after login** (user: "don't start the download when the chat opens").
  - `src/smartIndex.js` (tested):
    - `createIndexer(build)` is a single shared job. `ensure(docs)` runs once per journal state; a second caller gets the same promise. It notifies listeners (loading + step/pct, then ready / off), keeps the old vectors usable during a rebuild, and never throws at callers.
    - `shouldAutoWarm(navigator)` is false on Data Saver or 2G (then the chat starts the job when opened).
    - The app-wide instance is `smartIndex`.
  - `Journal` calls `smartIndex.ensure(docsFromPlaces(places))` via `requestIdleCallback` (timeout 4 s; `setTimeout` 1.5 s fallback) once places have loaded. `CravingChat` subscribes to the same job instead of building its own.
  - `buildIndex` now ALWAYS loads the model at the end, even when every vector is cached (from Cache Storage, no download). Before this, the first question paid about 3 s for the model.
  - **Storage on the device** (answering the user):
    - The model files are in the browser's **Cache Storage** (`transformers-cache`).
    - The dish vectors are in **IndexedDB** (`bitemark-ml`).
    - Neither is in localStorage, which only holds `space`, `theme` and `sort`.
    - Both survive closing the app, logging out and app updates. They are lost only if the site's data is cleared, and then they rebuild once.
  - **Verified (Playwright):**
    - After a reload the chat opens already showing "Smart matching on".
    - Measured in the page, button press to answer on screen took 55–63 ms, including the first question. Earlier 2–4 s readings came from Playwright's own waiting, not the app.
    - The job itself: embedding a question 11–18 ms, ranking 200 dishes 4 ms. 92 tests pass and the build passes.
