# BiteMark — Frontend scope

Everything in the browser: React components, styling, client-side logic (search, craving chat, picker), the PWA shell, and the map.

> Update this file whenever a frontend decision is made or a task finishes. Newest decision log entries go first.

## Product in one paragraph
BiteMark ("Remember every great bite") is a personal food journal PWA, used mainly in Gujarat (Vadodara, Ahmedabad). You log a **place**, then its **dishes**. Each dish has a price in ₹, a 1–5★ rating, an order-again flag (yes/maybe/no) and a note. Notes are often in Gujarati or Hindi slang ("ekdum mast", "tikhu"). Places can be personal or shared into **groups**. In a group, ratings are averaged across members, and there are reactions, comments and an activity feed. Other features: a wishlist of places you want to try, a random "Where to eat?" picker, a "Craving something?" chat, and a Map tab (in progress).

## Stack & conventions
- React 19, Next.js 16.4.3 in single-page mode (since 2026-10-31; was Vite 8), Tailwind 4 (`@tailwindcss/postcss`). Plain JSX, no TypeScript, no router (the app routes itself from the URL).
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
| `useGestures.js` (+`gestures.js`), `Toast.jsx` (+`undo.js`), `StoryCard.jsx` (+`foodStory.js`) | Phone polish: swipe-to-close sheets, pull to refresh, Undo toast, the "food story" in the You sheet. |
| `search.js` | Fuzzy search with scores: exact match, prefix, synonym groups (including Gujarati/Hindi words), substring, typo tolerance. |
| `NearMe.jsx`, `FixLocations.jsx`, `LocationField.jsx`, `PinPicker.jsx`, `LeafletMap.jsx` (+`geo.js`, `geocode.js`, `locate.js`, `locationValue.js`) | Exact positions and Near me (2026-10-28, branch `BiteMark/Near_Me`). Leaflet + OpenStreetMap, lazy-loaded. See the session log. |
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
  - Tiles are plain OSM, because CARTO now needs an API key. In dark mode the OSM tiles are inverted by CSS (`.lmap.osm-dark`).
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
- `BiteMark/Maps_feature`: an old Map tab experiment (commit 594a41f), "not accurate, not to be merged". Superseded by `BiteMark/Near_Me`, built fresh (its `geocode.js` is unrelated to the new one).
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
- 2026-10-26: **Login and app-start speed** (branch `BiteMark/Login_Speed`). The user asked for under 1 s.
  - **Measured root causes** (from India; Neon is in AWS us-east-2, Ohio):
    - Each request is a ~0.25 s round trip, and each NEW secure connection costs 1–3 s.
    - The free-plan Neon database sleeps when idle (~2.5 s to wake).
    - Requests ran one after another: session → groups → places.
    - Baseline from opening the app to the first card: 4.4 s cold, 1.6 s warm.
  - **`src/fastStart.js`** (tested):
    - `rememberLogin` / `recallEmail`: username → email on the device, so the next login skips `/api/auth-lookup`. Login retries with a fresh lookup if the remembered email fails.
    - `saveJournal` / `loadJournal`: a per-person, per-space snapshot (`bm.snap.<uid>.<space>`), shown at once and then refreshed.
    - `clearFastStart`: called on log out; removes the snapshots and keeps the login memory.
  - **Login page:** on mount it calls `/api/auth-lookup?ping=1` (new: `select 1` to wake the database) and `get-session` to open the auth connection while the user types.
  - **`index.html`:** `<link rel=preconnect>` to `%VITE_NEON_AUTH_URL%` and `%VITE_NEON_DATA_API_URL%`, filled in at build time.
  - **App:** Personal no longer waits for `groupsReady`. The profile is read first and `ensure_profile` runs only if the row is missing. Log out calls `clearFastStart`.
  - **Journal:** starts from the snapshot; places, wishlist and (in groups) profile names load in parallel; it saves a snapshot after each load.
  - **Results (Playwright):**
    - Opening the app while logged in: first card in **0.62–0.65 s** (was 1.6–4.4 s).
    - Login with username, first time on the device: lookup 0.87 s (database already woken), Neon Auth `sign-in/email` **1.94 s**, `get-session` 0.30 s, data 0.68 s in parallel. Every connection was already open (conn 0 ms).
    - Next logins skip the lookup.
    - Log out removed the snapshot.
  - **Can't be fixed in code:** Neon Auth's own sign-in (~1.9 s: deliberately slow password hashing plus several US database trips).
    - Option, not decided: move the Neon project to ap-southeast-1 (Singapore), with roughly 70 ms per trip. That needs a new project plus a data and auth-user migration.
- **SECURITY NOTE (2026-10-26):** Claude accidentally printed `DATABASE_URL` (including the password) into the session output while timing requests. The user was told to reset the `neondb_owner` password in Neon and update `.env` and the Vercel env vars. **Never `source .env` in a shell where variables or background jobs can be echoed.**

### 2026-10-27: phone polish (branch `BiteMark/Mobile_Polish`, cut from origin/main 583950f after PR #5)
Asked for: cleaner and smoother phone UX with small animations, at least 4 improvements. The picks were Claude's.
- **Swipe down to close sheets** (`useSheetDrag` in `src/useGestures.js`, maths in `src/gestures.js`, tested). Used on:
  - the place detail sheet
  - the filter sheet
  - the Craving chat
  - the Spaces / You sheets
  - **How it behaves:** the sheet follows the finger and the scrim fades with it. On release it closes past ⅓ of its height (at most 140 px), or on a quick flick (>0.5 px/ms). Otherwise it springs back.
  - **When a drag starts:** only when the content under the finger is scrolled to the top, and never on range sliders, text areas or anything marked `[data-nodrag]`.
  - **Not on `PlaceForm`**, on purpose: a stray swipe would throw away typed dishes.
  - **Implementation details:**
    - The hook writes `style.transform` directly (no React render per move).
    - It sets `animation:none` first, because the `up` keyframe's fill mode would otherwise override inline transforms.
    - Phones only (`max-width: 1023.98px`).
- **Pull to refresh** on Home and Want to try (`usePullRefresh`). A round badge slides out from under the top bar, rotates with the pull, turns green at the refresh point (70 px), then spins while `load()` runs.
  - The browser's own pull-to-reload is off on phones (`overscroll-behavior-y:none`). It would reload the whole app; installed PWAs never had it.
  - Ignored while any `.scrim` or dialog is open.
- **Want to try redesign:**
  - cards match place cards (category-coloured letter tile, pin + area, the note as a quote, Added by in groups)
  - "✓ We went", plus a new **Maps** button (Google Maps search for name, area and city)
  - a trash icon
  - **Remove has no confirm box any more.** The card slides out and a "Removed X · Undo" toast (`Toast.jsx`, portalled) shows for 5 s. The real delete happens afterwards (`src/undo.js`, tested).
    - Removing another item deletes the waiting one at once.
    - Leaving the tab also deletes it at once.
- **Your food story** in the You sheet (`foodStory.js` (tested) + `StoryCard.jsx`):
  - places, dishes and cities, which count up once when the sheet opens
  - favourite dish (best ≥4★; order-again then newest breaks ties)
  - your go-to food (most common family from the food dictionary, at least 2 dishes; broad moods such as Drinks, Something cold, Spicy, Snacks and Breakfast are excluded)
  - % order again
  - most visited city (only if there is more than one city)
  - It covers the open space.
  - Phone sheet only; the laptop dropdown is unchanged.
  - Named `StoryCard.jsx`, not `FoodStory.jsx`: on Windows, `./FoodStory` would resolve to `foodStory.js`.
- **Small touches:**
  - The bottom-bar active tab gets a soft green pill that springs open (`.navico`). Groups and You light up while their sheet is open; Home doesn't then.
  - Switching tabs fades and rises content slightly (`.tabin`, keyed on `view`).
  - Android gives a short vibration on +, on a sheet dismiss and on refresh (`buzz()`).
  - New icons: `refresh`, `trash`, `map`, `repeat`.
- **Verified:**
  - 123 tests pass; the build passes.
  - Playwright at 390 px with synthetic touches:
    - a small drag springs back
    - a long drag or a flick closes the sheet
    - a pull refetches places
    - Undo restores the card with no DELETE request sent
  - Dark mode and the laptop layout were checked by screenshot.

### 2026-10-27: Send to friends + Add by voice (branch `BiteMark/Share_Voice`, cut from origin/main 0bfccc7 after PR #6)
Asked for: "Share to WhatsApp" (a clean picture of a place card for friends who don't use BiteMark) and "Add a dish by voice" (free browser speech, Hinglish), "without hindering UX". The defaults below were Claude's calls.
- **Send to friends.** A **Send** button in place details (only when the place has dishes) opens `ShareSheet.jsx`, a preview first, so you see exactly what goes out.
  - **Toggles:** Prices and My comments. Remembered per device in localStorage `share.prices` / `share.notes`.
  - **Phones:** "Share picture" uses the Web Share API with the PNG file plus a caption, so WhatsApp gets the picture with the text.
  - **No file sharing:** the button becomes "Download picture" and copies the caption.
  - **Always offered:** "Send as text" (a `wa.me/?text=` link, which also opens WhatsApp Web) and "Copy text". A cancelled share (AbortError) is silent.
  - **Picture** (`shareImage.js`, canvas, 1080 px wide, height fits the content):
    - a green band with a letter tile, name, area and categories
    - "What to order" with up to 4 dishes rated 4★ and up (best first, order-again breaks a tie), each with partial stars for group averages, price, a "Would order again" pill and a 2-line comment
    - "+N more dishes in my journal"
    - a BiteMark footer saying "My own ratings" or "Rated by <group>"
    - If no dish has 4★, it shows the best 3 under "What I tried" (honest rather than empty).
    - Fixed light colours, whatever theme the sender uses.
  - Logic in `shareCard.js` (tested): `pickShareDishes`, `shareCaption` (WhatsApp `*bold*`), `wrapLines`, `shareFileName`.
- **Add by voice.**
  - **Where:** **Say it** in the + menu starts listening at once, and the place-name field does NOT autofocus, so no keyboard pops up. The same bar (`VoiceAdd.jsx`) sits at the top of the Add / Edit place form (not for group cards, whose dishes aren't edited there).
  - **Hidden where unsupported:** shown only when `SpeechRecognition` / `webkitSpeechRecognition` exists (`speech.js`, tested). Firefox doesn't have it.
  - **Recogniser setup:** `lang = en-IN` (best for Hinglish), continuous, with interim words shown live. It stops after 2.5 s of silence, on Done, or at 45 s.
  - **Privacy:** Chrome sends the audio to its own speech service. It's free, but not on-device.
  - **Parser** `voiceParse.js` (tested, 18 cases):
    - each pause or comma is a piece; "next" / "next dish" / "and then" starts a dish
    - price: rs/₹/rupees/rupaye/20rs/"two hundred fifty", or a bare number above 5 (capped at 9999)
    - stars: digits, English, Hindi/Gujarati (ek, do, teen, char, paanch), "3 out of 5", "rating 4"; clamped to 1–5
    - order again: "will order again", "dobara lenge", "phir se" → yes; "never again", "kabhi nahi" → no
    - Number words only count next to a price or stars, so "paneer do pyaza" stays as it is.
  - **How the place is found:**
    1. a place already in your journal at the start
    2. "… at <place>"
    3. a first piece that isn't a known dish
    4. all in one breath: `dishWordIndex` (new in `foodLexicon.js`; "masala dosa" and "rava dosa" were added) finds where the dish starts
  - **Into the form:** `mergeSpokenDishes` (placeRules, tested). It fills only the empty parts of a dish already in the list; new dishes are appended. The place name is filled only if empty.
  - **A place you already have** fills its city, area and categories, and offers **"Add dishes there"**, which opens that place in Edit with the new dishes merged in (no duplicate card). This needed `key={editing?.id || 'new'}` on `PlaceForm`.
  - Nothing is saved until you press Save.
- **New icons:** mic, send, download, copy.
- **Verified:**
  - 165 tests pass; the build passes.
  - Playwright on phone and laptop:
    - Send preview and caption; the toggles redraw the picture.
    - Voice via a fake recogniser installed in the page (Chrome now also has the unprefixed `SpeechRecognition`, so both names must be faked): live transcript → place + dish + stars + Order again; the "already in your journal" → Edit place path.
  - Real microphone and the real WhatsApp share are left for the user's phone.

### 2026-10-27: Order-again label + full smoke test (branch `BiteMark/Smoke_Fixes`, cut from origin/main 37744f8 after PR #7)
User report: the Yes / Maybe / No buttons on a dish didn't say what they were for. The user then asked for a full smoke test and to fix every UI and functional bug on phone and laptop.
- **Order again, labelled.**
  - New shared `StarPicker` and `OrderAgain` in `shared.jsx`, used by Add/Edit place, group "Add a dish" and group "Rate this dish".
  - Layout: "Your rating *" with stars, then "Order again?" with a Yes / Maybe / No segmented control (Yes green, No red).
  - Both are radio groups with aria labels; stars have "N stars" labels.
  - Group ratings list now says "Order again: Yes" (was "order again: yes").
- **Smoke test.** Playwright at 390 px and 1280 px, light and dark:
  - Phone: every Home tool, filters, sort, place details, Add to group, Add/Edit/Delete place, Want to try (add, We went), Craving, Where to eat, Spaces, a group (places, a dish, ratings, Activity), You, Change password.
  - Laptop: sidebar, the dropdowns, Price, the + menu, place details, Groups dialog, the account menu.
  - Logged-out Login / Sign up / Forgot password, in a separate browser session.
  - Real writes were limited to one test place ("ZZ Smoke Test Cafe"), saved then deleted.
- **Bugs found and fixed:**
  1. **Being offline at start looked like being logged out.** Neon Auth's `getSession` throws "Failed to fetch" and emits `INITIAL_SESSION:null`, so App showed the Login page.
     - Now App remembers who is logged in on this device (`rememberUser` / `recallUser` in `fastStart.js`: id, email and username only, never tokens; removed by Log out). If the server is unreachable, the saved journal opens with a banner.
     - It re-checks on the `online` event and every 15 s. Only a real "no session" answer shows Login.
     - "No session" events before the first answer, or while offline, are ignored.
  2. **A failed load popped a raw `alert("Failed to fetch")`.** On a first open without a saved copy, it also showed "Your journal is empty" with "load sample data". Now a calm banner says "No connection. Showing your journal from this device." or "Couldn't load your journal.", with Try again, and never the empty state.
  3. **A failed group-list load counted as "you're in no groups"** and threw you out of a group space into Personal. `loadGroups` now returns null on error, the space is only reset after a real answer (`groupsKnown`), and groups reload when the connection returns.
  4. **The greeting flashed "Your places" for 1–4 s on every open.** The username is now remembered on the device. The "still checking" state (`session === undefined`) no longer clears it, and a failed username read is no longer treated as a missing profile (which used to call `ensure_profile` for nothing).
  5. **Escape closed every layer at once** (Add to group also closed the place details). New `layers.js` (tested): `useEscape(onClose)` in every sheet and dialog closes only the top one. Added to the dialogs that had no Escape (Change password, Add a dish, Groups, Where to eat, Add to group, Add/Edit place) and to the laptop account menu.
  6. **The search box showed two ✕ buttons** (Chrome's own plus ours). The native one is hidden in CSS.
  7. **Where to eat used plain browser dropdowns** for City and Category (the same complaint as the laptop filters before). They are now `ChipSelect`. ChipSelect now opens leftwards when there's no room on the right; it used to run off the phone screen and cause sideways scroll.
  8. **The laptop account menu was wider than the sidebar,** so it was cut off with a sideways scrollbar. It now matches the sidebar width.
  9. **Groups said "0 members" while loading.** It now says "Loading members…".
  10. **Dishes with no price showed a lone "–"** (Craving results, place details, group dish). Now nothing is shown.
  11. **Leftover emoji icons:**
      - The Add to group list (👥) and its done ✓, Where to eat (📍 🧭 🎲), the Groups empty state and the "Save to" select (👤 👥) now use line icons and a shared `GroupBadge`.
      - "Save to" in Add place is now a row of chips instead of a native select.
      - Dialogs' bare "×" close buttons are now the x icon with `aria-label="Close"`.
  12. **A crash in any screen blanked the whole app.** `ErrorBoundary.jsx` around App now shows "Something went wrong. Your journal is safe" with a Reload button.
- **Seen but left alone:** Activity's emoji event badges (a playful feed, kept on purpose) and data typos in group entries.
- **Verified:** 173 tests pass; the build passes. Each fix was re-checked in Playwright, including blocked-network runs (Personal and group).

### 2026-10-28: First-visit tour, Feature guide and screen recording (branch `BiteMark/Feature_Tour`, cut from origin/main bbf1010 after PR #8)
Asked for: new users with an empty journal don't know what the app does. Wanted: a demo video of the important features on first signup, a guide explaining every feature, and the video always available. User's choice: **A + C**, an animated in-app walkthrough for first-timers plus a real screen recording in the guide.
- **The tour** (`Tour.jsx`, scenes in `TourScenes.jsx`, logic in `tourPlan.js`, tested).
  - 11 scenes, about 60 s, played like stories: progress bars (tap one to jump), tap right/left for next/back, hold (or Space) to pause, ← → keys, Escape or ✕ to close, "Skip the tour".
  - Each scene is a small animated copy of a real screen with sample data (CSS-only `.ts-*` motion; reduced motion shows the final state), plus a title and one sentence.
  - Scenes: welcome, scan, voice, rate, find, craving, pick, wish, groups, send, story.
  - The last scene waits for you (it doesn't auto-close) and offers **Add my first place** (opens the + menu) and **See all features**.
  - **Opens by itself only for a brand-new account** (`shouldAutoTour`): only once Journal reports `ready` (loaded, not failed), with 0 places and 0 Want to try, in Personal, and only if not seen before on this device. Stored in localStorage `bm.tour.<uid>`, which Log out does **not** clear. Existing users are never interrupted.
  - Named `tourPlan.js`, not `tour.js`: on Windows `./Tour` resolved to `tour.js` and broke the build (third time this happened; saved to memory).
- **Feature guide** (`FeatureGuide.jsx`, content in `features.js`, tested).
  - A sheet (right panel on laptops) titled "How BiteMark works": ▶ Play the tour and 🎬 Watch it in action at the top, then 17 features in 4 groups (Add what you ate, Find it again, Plan and share, Handy extras), each with one plain sentence.
  - Most items have **Try it**, which opens the real thing (App `tryIt`): the + menu, Say it, the Add place form, the focused search, the filter sheet (phones), Craving, Where to eat, Want to try, Groups, You (the laptop account menu now also shows the food story), and dark mode.
  - **Always reachable** from:
    - a **?** button in the phone top bar
    - "How BiteMark works" in the You sheet / laptop account menu
    - a sidebar item on laptops
    - the empty journal ("Play the 1-minute tour" and "See all features")
- **Screen recording** (`DemoVideo.jsx`): `public/demo/bitemark-demo.mp4` (H.264, 430×932, 53 s, 1.6 MB, plays everywhere) plus `poster.jpg`.
  - It shows search, filters, place details, Send, Craving, Where to eat, Say it, Want to try and the food story, with captions and a tap marker.
  - **Recorded with no real data and no writes:** `e2e/demo/record-demo.js` runs in a separate Playwright browser session where every Neon Auth and Data API request is answered locally. It returns a fake session (with a `set-auth-jwt` header and CORS headers) and the fictional journal in `e2e/demo/demo-data.json` ("Aanya": 8 places, 19 dishes).
  - **How to re-record** after UI changes is written at the top of that file. Playwright needs its own ffmpeg once, revision 1011 matching the MCP's playwright-core (`node <playwright-core>/cli.js install ffmpeg`). The MP4 conversion used npm `ffmpeg-static` in a temp folder, not a project dependency.
  - The video is recorded at the page's CSS size; deviceScaleFactor is ignored, which is why it uses a 430 px "large phone".
- **Also fixed:** Picker, Groups, Change password, Add a dish and Add to group overlays now have `role="dialog"`, `aria-modal` and a label (screen readers didn't know they were dialogs; pull-to-refresh now also pauses under them).
- **New icons:** play, pause, help, film.
- **Verified:**
  - 189 tests pass; the build passes.
  - Playwright on phone and laptop:
    - all 11 scenes rendered
    - a simulated new account (places and wishlist answered empty) got the tour automatically, and not on the next visit
    - your real account (44 places) never did
    - the last scene's "Add my first place" opens the + menu
    - every Try it opens the right screen
    - the video plays (no error); closing it returns to the guide

### 2026-10-28: Open in Google Maps everywhere + exact Maps links (branch `BiteMark/Maps_Links`, cut from origin/main ad3aad2 after PR #9)
Asked for: every screen with address or location fields should open Google Maps directly, plus an exact Maps link (the user agreed to the "paste the real link" idea).
- **`mapsLink.js` (tested):**
  - `mapsUrl(place)` returns the saved `maps_url` if it's a valid Google Maps link. Otherwise it builds a free Google "Maps URLs" search (`/maps/search/?api=1&query=`) for name + area + city (`placeWhere`, so "-" placeholders are skipped). It returns null when there's no name (no button then).
  - `isMapsLink` accepts https links only: `maps.app.goo.gl/…`, `goo.gl/maps…`, `maps.google.*`, and `google.*/maps…`, up to 500 characters.
  - `findMapsLink(text)` picks the link out of a pasted WhatsApp message.
- **Where Maps opens:**
  - **Place details:** a Maps button next to Edit / Send, and the address line itself is a link (`MapsWhere`, `.mapswhere`).
  - **Want to try:** the card's Maps button (it now uses the saved link too) and the address.
  - **Where to eat:** the picked place's address plus a **Directions** button.
  - **Send to friends:** a new **Map link** chip (on by default, remembered as `share.map`) adds `Map: <link>` to the WhatsApp text. A picture can't hold a link.
  - **Place cards themselves:** no map button, because the whole card is already a button and nested buttons are invalid. One tap opens details, which has Maps.
- **Optional exact link** (`MapsLinkField.jsx`) in Add/Edit place and Add to Want to try.
  - Pasting a whole WhatsApp message keeps only the Maps link. A **Check** button opens what Maps will show.
  - Wrong links are flagged in red. `placeFormError` / the Want to try form refuse them (`MAPS_HINT`).
  - It carries over: Want to try → "We went" → the place, and a personal place → a group card (ShareDish).
- **Before the DB migration runs** (`mapsSave.js`, tested): `skipUnknownMaps` retries the insert/update without `maps_url` when the API says the column is unknown, and says once that the link wasn't saved. Nothing else breaks. `maps_url` is only sent when there's a link (or one is being cleared).
- **Also fixed:** some dialogs didn't stop the page behind from scrolling. On phones a scroll inside Where to eat / Groups / Craving etc. dragged the page, and on laptops the page scrollbar pushed the picker off the edge.
  - New `useScrollLock()` in `layers.js` (counted, so nested layers unlock only when the last closes; tested) is used by every sheet and dialog.
  - It replaces the hand-written locks in PlaceDetail, FilterSheet and Tour. The laptop + menu dropdown isn't locked on purpose (it would make the page jump).
- **Feature guide:** a new "Directions" item.
- **Verified:**
  - 209 tests pass; the build passes.
  - Playwright on phone and laptop: place-details Maps and address links, the caption map line, Want to try Maps, a bad link flagged, pasted WhatsApp text reduced to the link, Check in the forms, picker Directions, and the scroll lock with nested layers (details → Send).
  - Real saving of a link still needs the migration (next item).
- **Bug (user report, same branch): "Maps button doesn't appear after I add a dish."**
  - The place-details action row didn't wrap. Send only shows once a place has a dish (and Add a dish shows in groups, Bill when a bill exists), so with 4 buttons Maps was pushed off a 390 px screen: it ended at 409 px. "Add a dish" was also squeezed to 3 lines.
  - Fixed: `.detail-actions` now wraps and its buttons keep their label on one line. Checked at 390 and 320 px, personal and group: nothing off-screen.

### 2026-10-28: App-styled confirm and message boxes (branch `BiteMark/App_Dialogs`, cut from origin/main b74c404 after PR #10)
Asked for: on delete, an "Are you sure?" popup with a bit of animation instead of the browser's own; replace every browser popup with an app-themed one.
- **Carried into this branch:** the uncommitted Maps-wrapping fix (`.detail-actions`) from `BiteMark/Maps_Links`, which was merged without it.
- **`dialogs.js` (tested):** a queue of boxes. `await askConfirm({ title, message, confirmLabel, danger })` → true / false; `showAlert({ title, message })` resolves when closed (default tone "error"). Several at once wait their turn.
- **`DialogHost.jsx`** is mounted once in `main.jsx` next to App, so it also works on the Login page. It's drawn in a portal at z-70, above sheets, the tour and the video.
  - The card pops in with a spring (scale .92 → 1); on answer it plays a 140 ms fade/shrink, then resolves.
  - Icons: a trash can with a single wiggle for deletes (`danger`: red icon and red **Delete** button `.btn-danger`), a warning triangle for errors, a question mark for other confirms.
  - Deletes focus **Cancel** (a stray Enter never deletes); other boxes focus the main button.
  - Escape or tapping outside cancels. It uses `useEscape` (top layer only, so the form behind stays open) and `useScrollLock`.
  - `role=alertdialog` / `dialog`, labelled by the title and message.
- **Replaced all 16 browser popups (none left; grep confirmed):**
  - **Deletes:** place (personal and group), group dish, bill photo, group, leave group, remove member.
  - **Other confirms:** new invite code, make owner.
  - **Errors:** save failed, place saved without its bill photo, delete failed, remove from Want to try failed, sample data failed.
  - **Maps link:** "saved without the map link" (before the migration), now worded for users.
  - Titles are now short questions ("Delete “Sankalp”?"), with the consequence in the message.
- **New icon:** alert.
- **Verified:**
  - 215 tests pass; the build passes.
  - Playwright, phone and laptop, light and dark: Edit place → Delete shows the box (Cancel focused).
    - Escape and Cancel close only the box, the form stays, and nothing is deleted.
    - The Groups "Delete group" box sits above the Groups dialog; Cancel leaves the group untouched.
    - The error box closes with Enter.
    - No native browser dialog fired at any point.
- **Instant deletes (user report, same branch): "After Delete in the popup, the Edit form shows again for about a second, then it's deleted."**
  - Cause 1: PlaceForm awaited the server delete (a US round trip) before closing.
  - Cause 2: the dialog waited for its 140 ms fade before answering.
  - Fixes:
    - **DialogHost answers at once**; a leftover copy plays the fade (click-through).
    - **`optimistic.js` (tested):** apply on screen → run on the server → on error, undo and explain.
  - Applied to every delete:
    - **Place** (personal and group): PlaceForm hands it to `Journal.deletePlace`. Form and details close, the card disappears, and a "Deleted “X”" toast shows, all at once. The DELETE runs behind, then a fresh load. On failure the place comes back with "Couldn’t delete … It’s back in your journal".
    - **Group dish:** it hides at once (its list row collapses via `has-[.gone]:hidden`) and comes back on failure.
    - **Bill photo:** the next photo shows at once, or the viewer closes after the last.
    - **Groups:** Delete group and Leave vanish from the list at once (a `gone` set over the `groups` prop); Remove member drops the member at once. Each comes back with the error if the server refuses.
  - **Measured:** the form closes 35 ms after tapping Delete while the server takes 1.5 s (in-page timing; route-delayed DELETE).
  - **Verified with intercepted requests, so no real data was deleted:** the slow success hides the card plus the toast; the failure brings the place back with the error dialog; a group dish collapses at once and comes back on failure.

### 2026-10-29: Public demo account (branch `BiteMark/Demo_Account`, cut from origin/main 2f4e6e5 after PR #11)
Asked for: a public sample user with plenty of data so every feature can be tried. More than 70 places with 2+ dishes each, every category and rating, half Vadodara and half Ahmedabad, with real well-known places (researched).
- **Q&A with the user:**
  - "test" / "test" isn't possible: Neon Auth refuses short passwords. The user chose a **"Try the demo" button**, with **test / test1234** typed in opening the same demo.
  - Wanted: a popup saying changes aren't kept after log out.
- **Accounts:** `DEMO_EMAILS` in `src/demoAccount.js` lists both; each has its own copy of the sample journal. Both use example.com, a reserved domain, so mail can't reach a real person. Both were created through the app's normal sign-up (no email verification needed).
  - **Demo** / `demo1234` (`demo.user@example.com`): what **Try the demo** signs in as (the user asked for it on 2026-10-28).
  - **test** / `test1234` (`demo@example.com`): the first demo account, still a demo.
- **`src/demoAccount.js` (tested):** `DEMO`, `isDemoUser` (by email), and "fresh once per visit" kept in sessionStorage (`bm.demo.ready`): `demoNeedsReset` / `markDemoReady` / `forgetDemoReady`.
- **Login:** an "or" divider and **Try the demo** (signs in with the demo credentials), with the hint "A sample journal with 72 places…".
- **App, when the demo is logged in:**
  - **A new visit** (a new tab, or after log out) shows "Setting up the demo journal…" while the `reset_demo()` RPC restores the sample journal. It then clears local snapshots, switches to Personal, and reloads groups.
  - **The welcome popup** (an app dialog) says it's a shared journal, nothing is kept, and it resets on log out, with **Play the tour** or **Explore on my own**. The automatic first-visit tour is off for the demo, so they never stack.
  - **A reload** in the same tab keeps your changes (no reset, no popup).
  - **An orange banner** on every screen says "Demo account: changes reset when you log out", with a Log out link.
  - **Log out** calls `reset_demo()` (at most 5 s wait) before signing out.
  - **Change password** is replaced by "Password can’t be changed in the demo", so one visitor can't lock everyone out.
- **Data:** `db/demo/demo-seed.mjs`. Its coverage is tested in `src/demoSeed.test.js`:
  - 72 places (36 Vadodara, 36 Ahmedabad) and 220 dishes, 3–4 per place.
  - Every category: Food 47, Cafe 18, Healthy 6, Dessert 7 (some places have two).
  - Every rating: 1★ 10, 2★ 19, 3★ 56, 4★ 87, 5★ 48. Order-again yes / maybe / no all appear.
  - Prices ₹15–₹1500; Craving families (dosa, idli, khaman, dabeli, pav bhaji, pizza, momos, cold coffee, kulfi, salad, thali, paneer); visit dates spread over 6 months.
  - Plus 6 Want to try places and a **"Weekend Foodies"** group: 5 places with ratings, reactions, comments and 2 wishes. Its Activity feed fills through the existing triggers.
  - Places come from food guides (Culture Trip, MakeMyTrip, Swiggy, EazyDiner, Wanderlog, Outlook Traveller, magicpin): Mandap, Sasumaa, Kai Asia, 22nd Parallel, Jagdish Farsan, Mahakali Sev Usal, Duliram Pedawala, Kaffa…, and Agashiye, Vishalla, Gordhan Thal, Das Khaman, Swati Snacks, Chandravilas, Manek Chowk, Lucky, Jasuben…
  - Areas and prices are approximate; the ratings and comments are invented.
- **Known limit (by design):** one shared account. Two visitors at the same time see each other's changes, and one visitor's log out resets the other's view on their next load. Fine for a demo.
- **Verified:**
  - 231 tests pass; the build passes.
  - Playwright in fresh browser sessions: Try the demo → welcome popup (no tour behind) and banner; the You sheet shows no Change password; the banner's Log out → login page; typing test / test1234 → the same demo; a reload → no new reset or popup.
  - **The reset itself isn't verified yet:** it needs the SQL below to be run.

### 2026-10-28: Exact locations + Near me (branch `BiteMark/Near_Me`, cut from origin/main 69c3e38 after PR #13)
Spec: `docs/superpowers/specs/2026-10-28-near-me-design.md`. Plan: `docs/superpowers/plans/2026-10-28-near-me.md`.
- **The user's decisions:**
  - Positions come from **"I'm here" (GPS) + a pin on a map + reading a pasted Google Maps link**.
  - Near me is a **List / Map toggle**, with List as the default.
  - Old places are fixed through a **guided Fix locations review**. Nothing guessed is saved unseen.
  - Near me shows **the current space plus its Want to try list**.
  - Everything must be **free**.
- **Free stack:**
  - Leaflet 1.9.4 (npm) with OpenStreetMap tiles; the "© OpenStreetMap" credit is always visible. Dark mode inverts the tiles with a CSS filter.
  - Photon (`photon.komoot.io`) for search and guesses: no key, CORS allowed.
  - The browser Geolocation API for "I'm here" and Near me.
  - `api/maps-resolve` for short links.
  - Distances use haversine on the device.
  - Leaflet loads through a dynamic `import()` only when a map opens. The main bundle is unchanged.
- **Logic (all tested):**
  - `geo.js`:
    - `hasCoords` and `isLocated`. A position counts only with `loc_source` gps / link / pin; lat/lng without it are **old unchecked guesses** (see the backend note).
    - `distanceKm`, `formatDistance` ("850 m" / "3.2 km" / "13 km").
    - `coordsFromMapsUrl`, which prefers `!3d!4d` (the place) over `@` (the map centre).
    - `isShortMapsLink`, `nearby`, `directionsUrl`, `bestRating`, `pinColor`.
  - `geocode.js`: `searchPlaces`, `fallbackQueries`, `guessSpot`. A result counts as "the place" only when its name matches; Photon answered "Mandap" with a nearby hotel.
  - `locate.js`: `getPosition`, giving errors denied / unavailable / timeout / unsupported; `GOOD_ACCURACY = 50` m.
  - `locationValue.js`: `locationRow`, `locationOf`, `locationFromLink`.
  - `mapsSave.js` now also drops lat / lng / loc_source when the API doesn't know them yet.
  - `mapsUrl` opens the exact coordinates when a place has them; a saved Maps link still wins.
- **UI:**
  - **Place and Want to try forms:** an "Exact location" block with **I'm here** and **Set on map**.
    - Once set, it shows a still map preview, how it was set (GPS ±N m / from the link / pinned), **Adjust** and **Remove**.
    - Pasting a Maps link fills it in. If a position already exists, it asks before replacing it.
    - GPS worse than 50 m opens the pin map at that spot instead of saving.
  - **Map sheet (`MapSheet` in `LocationField.jsx`):** a portal above the form with search (debounced 400 ms), a draggable pin, tap-to-move and "Use this spot".
  - **Near me (view `near`):**
    - Sidebar item on laptops; on phones, a full-width quick tile under Craving? / Where to eat? (the bottom bar is full).
    - Chips: 1 / 3 / 5 / 10 km (default 5), categories, Order again, Want to try.
    - Cards show the distance and Directions (`/maps/dir/?api=1&destination=lat,lng`).
    - Map: a blue "you" dot and pins coloured by best rating; wishes get bookmark pins. Tapping a pin shows a card that scrolls into view on phones.
    - Error states: permission denied (how to fix it), unavailable or timeout, none located, nothing in range (showing the nearest and a "Show N km" button).
    - The "N places need an exact location · Fix now" banner counts places you can edit.
  - **Fix locations:** one place at a time, starting from the old guess if there is one, otherwise `guessSpot`. Actions: Looks right / Use this spot / Skip, then "Located N of M".
    - It also covers **Want to try entries** (`needsLocation` in `locationValue.js`; each item carries `.table`), because that list has no edit form.
    - Esc, the scrim and X all reload when something was saved.
  - **Group save onto an existing card:** your position is applied only if the card has none (`.is('loc_source', null)`). Otherwise an info box says it wasn't changed.
  - **Final review (fresh reviewer, 2026-10-28):** 3 Important findings and 2 re-graded from Minor were fixed: the migration rule, wishes in Fix, Esc reload, the group card location, and the dark Near me tile (`--near-soft` / `--near-ink`). The deferred minors are listed under Open.
  - **Feature guide:** "Near me" (Try it → `near`) and "Exact location" were added.
- **Bugs found while testing and fixed:**
  - Leaflet `_leaflet_pos` crash when a map unmounted mid-animation. It now calls `stop()`, clears the resize timer, and uses non-animated setView / fitBounds.
  - Re-framing all pins on every pin tap.
  - The List/Map toggle stacking icons above the labels.
- **Verified in Playwright:**
  - 390 px light and 1280 px dark.
  - Forms: GPS ±9 m; a full link read; pin search, tap and save, where the POST body carries lat/lng/loc_source.
  - Near me: sorted 140 m … 4.3 km; the 1 km filter; 5 pins; exact Directions; the denied state.
  - Fix locations: the PATCH body; Skip; the summary; no page errors with fast navigation.
- **Status:** the user runs `db/migrations/2026-10-30-place-location.sql`, then the regenerated `2026-10-29-demo-account.sql` (see the backend doc). Not committed.
- **Open:**
  - Short-link resolving (`maps.app.goo.gl`) is unit-tested with stubs only. Check it with a real shared link on the deployed site.
  - Deferred minors from the review:
    - `@lat,lng`-only links are labelled "From the link" although `@` is only the map centre.
    - The link-confirm dialog doesn't re-check that the form is still open.
    - In dev StrictMode the link check fires on edit open.
    - `guessSpot` with an empty name.
    - The search spinner can stick after the box is cleared.
    - A failed Leaflet chunk load stays cached until reload.
    - Near me "Update" failures are silent when a position already exists.
    - Map sheets don't move keyboard focus.
    - Demo area-centre positions are stored as `pin` (shown as exact).
    - The resolver regex accepts any 2–3 letter `google.*` TLD.

### 2026-10-28 (later): Exact location via Google Maps (same branch `BiteMark/Near_Me`)
- **User feedback:**
  - The "44 places to fix" banner nagged.
  - OpenStreetMap search and guesses didn't find their places, while a Google Maps search for name + area + city opens perfectly.
  - "Use this spot" showed "needs a one-time update on the server". The migration had run but the Data API cache wasn't refreshed yet; it works now.
- **Options offered (only free allowed):**
  - A. Google finds it, you copy its link (**chosen**).
  - B. Google Geocoding API: about 10k free a month, but needs a billing card.
  - C. Scraping Google Maps pages: against Google's terms, and fragile.
  - D. Smarter OpenStreetMap search.
- **Now:**
  - **`GoogleLocate.jsx`:** **Find on Google Maps** opens `findOnGoogleUrl(place)` (a search for name, area and city).
    - On return (visibilitychange or focus), **Paste link** pulses.
    - `pasteMapsLink(navigator.clipboard)` reads the copied link and reports `empty` / `not-maps` / `blocked`. On `blocked`, a box to paste into by hand appears.
  - **Forms:** the separate "Google Maps link" box is merged into Exact location as "Paste the link by hand". Before the location migration it's the only thing shown. A pasted link fills `maps_url` and its position, so both are saved.
    - Secondary options: **I'm here now** and **Place it on a map**. The map now starts on the area or city, never on a guessed shop.
  - **Add exact locations** (`FixLocations.jsx`, renamed in the UI): per place, steps 1-2-3, then Find / Paste, the spot on a draggable map, and **Save & next** (saves lat/lng/loc_source **and** `maps_url`). Also "I'm there now" and Skip. No OpenStreetMap guesses.
  - **Near me:** the banner is gone. A quiet line under the results ("N places have no exact location yet… Add them ×") is hidden with × until the number grows (`showFixHint`, localStorage `bm.fixhint`).
    - When nothing is located yet, the empty state has the **Add exact locations** button.
  - **Place details:** a small **Add exact location** link for unlocated places you can edit. It opens a single-place version that closes on Save.
  - **Server not ready:** `useLocationReady()` (`locationReady.js`) checks `places.loc_source` once per app start (`checkLocationSupport`).
    - When it's missing, location buttons are hidden, the link box still works, and Near me says it isn't switched on. No more "couldn't save" popups.
  - `guessSpot` with no name no longer claims "found the place" (tested).
- **Verified (Playwright, 390 px light and dark):**
  - Find opens the exact Google search URL.
  - Paste fills the link and position; the save body has `maps_url` + lat/lng + `loc_source:'link'`.
  - Empty / not-maps / no-spot messages.
  - Add exact locations: PATCH with `maps_url`, Save & next, Skip, Esc.
  - The quiet hint and its ×; the details link and single-place sheet.
- **Note:** the live DB now has `loc_source`, so the location migration has run. The demo places have no positions until `2026-10-29-demo-account.sql` is re-run.

### 2026-10-29: Automatic area-level positions (same branch `BiteMark/Near_Me`)
- **User ask:** when no link is given, take Google's first search result (name + landmark + city) automatically and save it.
- **Explained:** an app can't read Google's results for free within Google's terms; it needs the paid API (card) or scraping.
- **The user chose A:** an automatic **area-level** position from OpenStreetMap; Google stays the way to get the exact spot.
- **How it works:**
  - **`areaSpot(p)`** (`geocode.js`, tested) looks up only the **landmark / area + city**, never the shop name.
    - Tries the whole landmark first, then each comma part from the last ("Express Hotel, Alkapuri" → "Alkapuri").
    - A result counts only if its name has **every** typed word (stop-words dropped) and it lies **within 25 km of the city centre**. That rejects The Fern for "Express Hotel" and Race Course Circle in Rajkot.
    - It prefers `osm_key=place` (a real area) over a shop with the same word, and **never** falls back to the bare city centre.
    - Live check: Navrangpura, Alkapuri, Law Garden, SG Highway, Lal Darwaja and Mandvi found; Race Course Circle, Sayajigunj and Gulbai Tekra gave none, never a wrong one.
  - Saved as **`loc_source = 'area'`**.
    - `isLocated` includes it; the new **`isExact`** covers gps / link / pin only.
    - `distanceLabel` shows "≈ 800 m".
    - **Directions** for area-level places uses `destination=<name, landmark, city>`, so Google navigates to its own first result. Exact spots use coordinates.
    - `mapsUrl` uses coordinates only for exact spots.
  - **`autoLocate.js`:** a background queue, one lookup at a time about 1 s apart. Each update has the filter `or=(loc_source.is.null,loc_source.eq.area)`, so an exact spot is **never** overwritten.
    - Each place is tried once per app start; just-saved places go first (`{ now: true }`).
    - It sends `bm:located` (every 5 found, and at the end) and the journal reloads.
  - **Journal:** once data is loaded and the server is confirmed ready (`useLocationReady({ strict: true })`), it queues every place and Want to try entry with no position that you can edit (old unsourced guesses included, which get replaced).
  - **Saves:** PlaceForm and Wishlist queue a lookup after saving when `wantsAreaLookup(loc, before, f)` (tested): never over an exact spot, again only if the landmark or city changed. The form closes immediately; no waiting.
- **UI:**
  - Area-level places show "≈" on the distance chip and a **hollow, dashed pin** on the map. The map caption explains hollow pins.
  - Form: "Placed by its area (≈). For the exact spot:" followed by Find on Google Maps / Paste link. When nothing is set: "Optional. Skip it and BiteMark places it by its landmark and city on its own (≈)".
  - Details: "Placed by its area · make it exact" opens the single-place Google flow.
  - The Near me quiet hint counts only places with no position at all.
- **Demo:** the 65 area-centre demo entries are now honestly `loc_source 'area'`; the 14 name matches stay `pin`. The SQL was regenerated.
- **Verified (Playwright):**
  - A save of "Unlocked / Navrangpura / Ahmedabad" without a location closes the form at once, then PATCHes `{lat 23.036, lng 72.564, loc_source 'area'}` with the safety filter.
  - The demo's unlocated places start filling in the background.
  - Near me shows "420 m" (exact) and "≈ 800 m" (area); one hollow pin; Directions uses coordinates for the exact place and the text search for the area-level one.
- **The user must re-run `db/migrations/2026-10-30-place-location.sql`** so the database allows `'area'`. Until then, background updates fail quietly (console warning) and nothing breaks.

### 2026-10-29: Near me without a distance limit (same branch)
- **User ask:** remove the 1/3/5/10 km chips; from Ahmedabad they also want to see all of Vadodara's places on the map.
- **Now:**
  - Every located place and wish of the space is shown, nearest first: `sortByDistance(items, me)` (tested). Without a position, places are sorted by name with no distances.
  - **City chips** ("All cities" plus each city that has located places) appear when there's more than one city.
  - It starts on **the city you're in**: `homeCity`, the city of your nearest place within 40 km (tested). Otherwise it starts on All cities.
  - Your blue dot is left off the map when you look at another city, so the map frames that city instead of zooming out over 100 km.
  - **Location blocked or unavailable** is no longer a dead end. A short note appears ("…so there are no distances") with a **Use my location** chip, and the list and map still work.
  - Removed: `RADII`, the radius state, "Nothing within N km" and the "Show N km" button. `nearby()` stays in geo.js (tested) but Near me doesn't use it.
- **Verified (Playwright, 390 px):**
  - In Ahmedabad: starts on Ahmedabad (Unlocked, then Swati Snacks).
  - Vadodara chip: Mandap "101 km", Jagdish Farsan "≈ 104 km"; the map shows 2 pins and no "me" dot.
  - All cities: 4 pins.
  - Location denied: the note shows and all 4 places are listed by name with no distance chips. No page errors.

### 2026-10-29: Bug: changing the landmark kept the old area position (same branch)
- **Report:** Coffea's landmark was changed from "13 Canal Rd" to "TP 13 Canal Road"; Near me still showed it at Ankodiya Canal Rd.
- **Causes:**
  1. When the new landmark couldn't be found (OpenStreetMap doesn't know "TP 13 Canal Road"), the old area-level position stayed.
  2. Matching ignored short words and numbers, so "13 Canal Rd" had matched "Ankodiya **Canal** Rd" in the first place.
  3. Nothing told the user.
- **Fixes (tested):**
  - `saveLocation(loc, before, f)` (`locationValue.js`): a changed landmark or city **clears** an area-level position in the same save, then looks it up again. Exact spots are untouched.
  - `areaSpot` word matching: every word counts, including numbers and 2-letter ones ("tp", "13"). Short words must be whole words of the result's name. The stop-words "road / rd / street / st / of / no / nr…" are ignored.
  - `autoLocate` sends `bm:notlocated` for a just-saved place it couldn't place. The journal shows "Couldn't place '…' by its landmark" (7 s) with **Fix**, which opens the place, where **Add exact location** is.
  - Form: an area-level position has a **Remove** link.
- **Verified (Playwright, real Photon):** edit Coffea to "TP 13 Canal Road" → the PATCH clears lat/lng/loc_source → the toast appears → Fix opens the details with "Add exact location".
- **Existing record:** places saved before this fix keep their old area spot until their landmark changes, or until it's replaced with Google (Find on Google Maps → Paste link) or removed.

### 2026-10-31: Bug sweep (login busy state, area placement, map zoom, tour)
- **Login: Try the demo made Log in say "Please wait…" too.**
  - `busy` is now which button is working (`'form' | 'demo' | null`).
  - **`loginLabels(busy, { forgot, isSignup })`** (`demoAccount.js`, tested): both buttons are disabled, but only the pressed one shows progress ("Opening the demo…").
- **Raj Rajeshwari (Fatehganj) never got a position.** OpenStreetMap has no area called "Fatehganj"; it spells it "Fatehgunj", and only inside a shop's address. `areaSpot` (tested) now:
  - splits on "/" as well as ",", e.g. "Alkapuri/Ellora Park";
  - tries the last word alone when the whole landmark is unknown, but only as an OSM `place` with exactly that name (e.g. "Kalasagar Mall **Ghatlodiya**");
  - falls back to **Nominatim**, the second free OSM search with CORS and no key:
    - the hit's name or address fields must contain the area's words;
    - spelling is compared loosely: no doubled letters, no h, u = a, w = v (Chhani ≈ Chani);
    - ganj/gunj variants are queried;
    - a hit must be within 25 km of the city;
    - at most 3 requests per place, 1.1 s apart.
  - **Live result on Kandarp's journal:** 5 more places placed, including Raj Rajeshwari (about 450 m from Google's pin, so "≈"), Chhani, Ghatlodiya and Ellora Park. 39 landmarks are genuinely not in OSM ("Neptune Trion", "Dev Deep Complex", "TP 13"…); they need Find on Google Maps → Paste link.
- **Silent: every app start re-asked OSM for every unplaced place** (about 45 lookups, forever).
  - **`lookupMemory.js`** (tested) remembers a miss in localStorage (`bm.areamiss`) per table:id plus landmark|city.
  - A miss is not retried for 14 days, or until the landmark or city changes.
  - A just-saved place (`now`) always tries. Offline (`navigator.onLine === false`) is not recorded as a miss.
- **Silent: tapping a pin on Near me re-framed the whole map** (lost your zoom).
  - LeafletMap's fit effect depended on the `markers` array identity, and NearMe builds a new one each render.
  - It now depends on **`boundsKey(markers)`** (`geo.js`, tested): ids and positions, order-free.
  - Verified with a fitBounds counter: 4 taps → 0 re-frames; changing city → 1.
- **Toast** text wraps to 2 lines instead of truncating. "Couldn't place '…' by its l…" was unreadable on phones.
- **Tour and Feature guide:**
  - New tour scene **`near`** ("Places near you, on a map") after Want to try.
    - It's a drawn street map (no tiles): your blue dot, pins drop in (one hollow ≈), a tap, then the Near me card with 850 m and Directions.
    - CSS `.ts-map*`, `.ts-pin`; pins use the `translate` property so the pop animation's `transform` doesn't cancel it.
    - `hasScene(k)` is exported from TourScenes, and a test checks that every tour step has a picture.
  - Guide texts updated: Near me mentions city chips; Exact location mentions automatic placement by landmark (≈); Directions no longer says to paste a link while adding.
- Checked, not a bug: the two "Raj Rajeshwari" rows are one personal and one group copy. The group copy gets placed when that group is opened (the queue runs per open space).

### 2026-10-31: Near me distance filter (1 / 3 / 5 / 10 km), List and Map
- **User ask:** add 1, 3, 5 and 10 km back, in both views, without hurting the phone or desktop layout.
- **Design (my calls):**
  - **One "Any distance ▾" picker** in the top row, next to List/Map, so the chip row doesn't grow. It uses the app's own **`ChipSelect`** (themed menu, keyboard ↑ ↓ Enter Esc), which now takes `disabled` and `title`.
    - The first try was a native `<select>` dressed as a chip. **Rejected by the user:** its open list is the browser's own and doesn't follow the theme. **Rule: every dropdown uses ChipSelect / the `.menu` look, never a native select.**
    - The menu opens above the map, because `.lmap` has `isolation: isolate`, which keeps Leaflet's z-indexes inside it.
    - No leading icon on this chip: with one, "Within 10 km" pushed the location button to a second row at 390 px.
    - New generic `.chip:disabled` style (dimmed, not-allowed cursor).
  - On phones "Update" becomes an icon (`max-sm:hidden` label; aria-label stays), so the whole row fits at 390 px.
  - **City and distance are exclusive:** a distance shows everything around you across cities (city → All cities); picking a city clears the distance. Combining them gave empty results, e.g. 3 km around you while viewing Vadodara from Ahmedabad. A saved distance also stops the start-up "your city" default.
  - **Map:** a dashed brand-colour **ring** of that radius around you (`LeafletMap` `circle` prop, `.lmap-ring`; on the overlay pane, so dark mode's tile invert doesn't touch it). `fit` frames the ring, and `boundsKey(markers, circle)` re-frames only when the distance or pins change.
  - **Nothing in range:** "Nothing within 1 km" plus a button for the next distance that finds something ("Show within 3 km"), or "Show any distance".
  - **Without your location** the picker is disabled (with a tooltip) and a saved distance is ignored until your position is known.
  - The distance is remembered in localStorage `near.radius`.
- **Pure logic** (`geo.js`, tested): `RADII`, `withinKm(items, km)` (inclusive; items with no distance are out), `widerRadius(items, km)`, `radiusLabel(km)`.
- **Verified (Playwright, Kandarp's journal, location mocked in Alkapuri):**
  - 1 km gives "Nothing within 1 km", and "Show within 3 km" shows 3 places.
  - On the map, 3 km and 10 km rings frame correctly; picking Vadodara clears the distance and removes the ring.
  - The desktop dark layout fits.
  - With location blocked, the picker is disabled and all cities are shown.

### 2026-10-31: Share from Google Maps (Task 1, map features)
- **What:** on an installed Android PWA, Share on a Google Maps place offers BiteMark. A sheet then lets you save the exact spot onto a matching place / Want to try entry, or start a new place or Want to try entry from it.
- **How:**
  - `public/manifest.webmanifest` has a GET `share_target` to `/share` (title, text, url); Vercel already rewrites it to the app.
  - `App.jsx` stashes the params in sessionStorage (`bm.share`) once at load and cleans the address to `/`. After login (and demo ready) it takes the stash, loads `places` and open `wishlist` (id, name, city, area, loc_source, group_id) and shows `SharedPlaceSheet.jsx`.
  - `shareTarget.js` (tested): `parseSharedPlace` (name / address / area / city / link; known cities = the user's cities plus Vadodara and Ahmedabad), `rankMatches` (folded-word similarity of at least 0.6, at most 3, same city first), `stashShare` / `takeShare`.
  - The link resolves with `locationFromLink`. Save writes `{ lat, lng, loc_source: 'link', maps_url }` by id with `.select('id')`; an empty result is an error ("you can't edit this place"). Add buttons open the PlaceForm (`addIntent.prefill`) or the Want to try form (`addIntent.wishPrefill` -> `Wishlist prefill`).
- **Decisions:**
  - Saving is an explicit tap, so it may replace an existing exact spot; a candidate that already has one shows "Replaces its current exact spot".
  - "Centre" and "Center" count as the same word (`geocode.js` `fold` is now exported; `shareTarget` also folds final -re to -er).
  - The old `ShareSheet.jsx` is the "Send to friends" picture sheet; the new one is `SharedPlaceSheet.jsx`.
  - Failures never leave a silent empty list: places that fail to load show a note and the Add options; an unreadable link says so.
- **Verified (Playwright, demo):** logged-out and logged-in flows, save, both Add buttons, no-link case, dark mode, phone and 1280px.
- **Not tested:** the real Android share from Google Maps (needs the installed app; reinstall may be needed to pick up the new manifest).

### 2026-10-31: "Are you at …?" (Task 2, map features)
- **What:** in Near me, when you're within 400 m of a place or Want to try entry that only has an area-level (≈) position, and your GPS accuracy is 50 m or better, a quiet card above the results (List and Map) says "You're near {name}. Save where you are as its exact spot?" with **Save exact spot** / **Not now**.
- **How:**
  - `hereNudge.js` (tested): `nearbyGuess(items, me, dismissed)` returns the nearest `loc_source 'area'` item within `NUDGE_REACH_M` (400), only when `me.acc <= NUDGE_ACC_M` (50). `nudgeDismissed` / `dismissNudge` keep `places:<id>` / `wishlist:<id>` keys in localStorage `bm.nudge.no` (blocked storage gives an empty set).
  - `NearMe` now keeps `acc` in `me` (markers, sorting and the ring use lat/lng only). Only items the user can edit are offered (`canEdit` from Journal). Save writes `{ lat, lng, loc_source: 'gps' }` by id with `.select('id')`; an error or empty result shows "Couldn't save the spot" inline. On success `onSaved` (Journal `load`) refreshes, and the card goes because the place is no longer area-level.
- **Decisions:** it is an explicit tap, so no exact spot is ever overwritten silently (exact places are never offered). One card at a time; after Not now, the next nearest candidate may appear.
- **Verified (Playwright, demo, location mocked 200 m from a ≈ place, accuracy 20):** card shows on the map view at 390 px and 1280 px, light and dark; Save sets `loc_source 'gps'` and the card disappears; Not now stores the key.

### 2026-10-31: Halo on ≈ pins (Task 3, map features)
- **What:** area-level (≈) hollow pins get a faint dashed 300 m circle while the map is zoomed in to 14 or more, so it is honest that the position is approximate. Hidden when zoomed out (it would swamp the map).
- **How:** `geo.js` exports `APPROX_HALO_M = 300` and `showHalo(zoom)` (zoom >= 14), both tested. `LeafletMap` draws one non-interactive `L.circle` (class `lmap-halo`) per `approx` marker into its own layer group (`halos`), refilled by the marker effect; a `zoomend` handler adds or removes the group, and it is applied once after the map is created. Fitting is untouched. `.lmap-halo` in `index.css` is fainter than `.lmap-ring` (dashed 3 5, fill .04), in `--pri`, so it reads in both themes (overlays are not inverted in dark).
- **Verified (Playwright, demo):** 35 halos at zoom 15+, 0 at the fitted zoom and after zooming back out; halos are `interactive: false` so they do not catch taps (tap not re-tested in the browser); 390 px and 1280 px, light and dark.
- **Phase 1 (accuracy) is done:** Share from Google Maps (Task 1), "Are you at …?" (Task 2), halo on ≈ pins (Task 3).

### 2026-10-31: Cluster bubbles + area summary (Task 4, map features)
- **What:** in Near me's Map view, crowded pins merge into count bubbles (`.mk-cluster`, BiteMark green) that split as you zoom. Tapping a bubble shows an **area card** under the map: "Alkapuri · 9 places · 4.3★ average · best: Masala dosa at Sankalp" (unknown parts left out) with **Zoom in** and **Show these**. **Show these** narrows the list and map to those pins, with a removable "× Alkapuri" chip above the results; the chip also clears on a city or distance change.
- **How:**
  - `leaflet.markercluster@1.5.3` loads inside `loadLeaflet()` (sets `window.L`, then imports the plugin and its CSS), so it is its own lazy chunk, not in the main bundle. Default.css is not used.
  - `LeafletMap` has `cluster` and `onCluster(ids, zoomIn)`. The group uses `zoomToBoundsOnClick: false` and handles `clusterclick` itself. Your blue dot and the selected pin go in the plain layer, outside the group. Without `cluster` (forms, Fix locations) nothing changes.
  - `mapInsights.js` (tested): `areaKey`, `areaSummary` (name = commonest area name, avg = mean of each place's best dish rating, best = top dish, ties most recent). Wishes count but have no rating. `AreaCard.jsx` is the card.
- **Decisions:** the area card and the pin's NearCard never show together; tapping a pin closes the area card. The area name is the commonest area among the bubble's places, so a mixed bubble is named after its biggest part.
- **Verified (Playwright, demo, 72 places):** bubble at the fitted zoom, tap shows the card, Zoom in splits it, Show these narrows to 38 places with the chip, the chip clears it; 390 px and 1280 px, light and dark.

### 2026-10-31: Readable pins (Task 5, map features)
- **What:** in Near me's Map view, pins show their place name from zoom 15 and the must-try dish under it from zoom 16. Wishes get a name only. The selected pin shows no label (its card says the same thing).
- **How:** `labelLevel(zoom)` (0 / 1 / 2) and `escapeHtml` in `geo.js` (tested). `LeafletMap` toggles `lbl-1` / `lbl-2` on the map container in the same `zoomend` sync as the halos. `icon()` wraps the pin in `.mkw` and adds `<b class="mk-name">` / `<small class="mk-sub">` beside the rotated `.mk`, so labels read upright. Label text is user text, so it is escaped before going into the divIcon HTML. `NearMe` markers carry `label` (name) and `sub` (`placeSummary(x).mustTry`). The icon size/anchor are unchanged (tip still on the spot); labels are `pointer-events:none`, so taps still hit the pin.
- **Look:** surface background, 1px line border, ellipsis at 140 px, works in dark via tokens.
- **Verified (Playwright, demo):** names at 15, dishes at 16, light + dark, 1280 and 390 px; pin tap opens its card and hides its label; bubbles still show at lower zoom.

### 2026-10-31: Real travel time and route line (Task 6, map features)
- **What:** in Near me's Map view, tapping a pin asks OSRM for the driving route from you. The card gets a line like "14 min drive · 3.8 km by road · 48 min walk" (with "≈" for area-level places) and the route is drawn on the map. Without your location, or if OSRM fails (offline, non-Ok, error), nothing extra shows and the straight-line chip stays.
- **Service:** the free OSRM demo server `router.project-osrm.org` (no key). Fair use: only after a tap, one request per tap, never prefetched, cached 10 minutes.
- **How:** `route.js` (tested): `routeUrl`, `parseRoute`, `walkMinutes` (4.8 km/h from road distance), `tripLabel`, `getRoute` (module cache keyed by your position rounded to 3 decimals plus the place, injectable `fetchFn` / `now`; failures are not cached) and `clearRouteCache()` for tests. `NearMe` runs the request in an effect on `sel`; a response is ignored if `sel` changed meanwhile. `LeafletMap` has a `route` prop (`[lat,lng][]`) drawn as a non-interactive `L.polyline` (`.lmap-route`, brand colour, 5 px, round caps, 78% opacity) in its own ref; it is not part of `boundsKey`/fit.
- **Decisions:** Map view's picked card only. List cards still open Details on tap, so they show no trip line.
- **Verified (Playwright, demo, mocked Vadodara location):** pin tap draws the route and shows "min drive", exactly one OSRM request; with OSRM aborted, the next tap shows the card with no error and no route; 390 px and 1280 px, light and dark.

### 2026-10-31: Map and list in step (Task 7, map features)
- **What:** in Near me's Map view, what the map shows drives the cards. Phones (< 1024 px): a swipeable `.nearrail` under the map (scroll-snap, ~85% wide cards, nearest first). Desktop: `.nearsplit` grid, map 3fr and list 2fr, the list scrolls and is as tall as the map. The caption reads "{n} places in this area" once the view holds fewer than all shown pins, else the old text.
- **How:** `inBounds(items, b)` in `geo.js` (tested: inside, edge, outside, no coordinates; no view yet keeps all). `LeafletMap` has `onView({south,west,north,east})`, fired on `moveend` and once after the first fit; it only reports, never fits, so panning does not re-frame. One DOM for both layouts (CSS media queries); the picked card is the full `NearCard` with its trip line.
- **Rail to pin:** an IntersectionObserver (root = rail, threshold 0.6) sets `sel` to the centred card after a 400 ms pause (fast swipes = one OSRM request). It acts only after a real touch/wheel/key on the rail (so the first paint selects nothing), and a ref flag stops the selection it made from scrolling the rail again. Phones only (`matchMedia`).
- **Pin to card:** a pin tap scrolls its card into view (`inline: center`, smooth unless reduced motion), on both layouts.
- **Desktop hover:** a separate `hover` key (not `sel`) is passed to the map as `selected`, so hovering lights the pin without an OSRM request.
- **Verified (Playwright, demo, mocked Vadodara):** 390 px swipe selects the pin and shows the trip, pin tap scrolls the rail, pan updates the caption without re-framing; 1280 px list in step, hover lights the pin; light and dark.
- **Phase 2 complete:** a smarter map (area bubbles, pin labels, travel time and route, map and list in step) is done.

### 2026-10-31: Food crawl planner (Task 8, map features)
- **`src/crawl.js`** (pure, tested): `crawlStops` (located only, max 8), `tripServiceUrl` (OSRM trip, `source=first`; your position leads only when known, otherwise the first stop is the source), `parseTrip` (orders stops by `waypoint_index`, drops your start), `googleDirectionsUrl` (coordinates for exact stops, "name, area, city" text for ≈ ones, last stop = destination, `%7C` between waypoints), `getTrip` (10-minute cache like `getRoute`; failures are not cached; errors give null).
- **Pick mode:** a "Plan a route" chip (Map view) toggles it. Pin and card taps toggle a pick (max 8, then a short note); `sel` is cleared and the Task 6 single-route fetch is skipped, and the rail's swipe-select is off. Cluster taps still work. Picked pins carry `num` (numbered pin, kept out of bubbles); cards read "Add to route" / "Added · n".
- **`CrawlBar`** (sticky above the rail/list): "n stops", Plan (disabled under 2, title "Pick at least 2 places"), Clear. After Plan: "Best order · 42 min · 11.3 km" (with ≈ if any stop is area-level), the line is drawn and the map frames it (`frameRoute`), pins renumber, and **Open in Google Maps** appears. If OSRM fails: "Couldn't plan the route right now", picks stay, Open in Google Maps still opens them in picked order. Leaving pick mode, Clear, or switching to List clears the crawl. Changing a pick drops the plan.
- **Verified (Playwright, demo, mocked Vadodara):** no OSRM request on entering pick mode or picking (0), one on Plan; blocked OSRM shows the error and the Google link; 9th pick refused; 390 and 1280, light and dark.

### 2026-10-31: Food heatmap + food home (Task 9, map features)
- `mapInsights.js`: `heatPoints(places)` gives `[lat, lng, w]` (`w = min(1, dishes/6)`, at least 0.2, located only); `foodHome(places)` gives `{ name, count }` for the commonest `areaKey` (first spelling seen, ties keep the first, null under 2 places; wishes aren't counted).
- `LeafletMap` `heat` prop (array or null): one `L.heatLayer` (leaflet.heat 0.2.0, loaded inside `loadLeaflet()`, so it is in its own lazy chunk), rebuilt when the points change, removed when null. It sits in the overlay pane (under the pins) and has `pointer-events:none`. `minOpacity` is .25 on light and .4 on dark tiles (read when the layer is built), since the glow looked muddy on dark.
- NearMe Map view: a **Heatmap** chip (`aria-pressed`). On: heat from journal places shown (no wishes), pins fade to 35 % (`.nearmap.heat-on .leaflet-marker-icon`, still tappable), and a line "Your food home: Alkapuri (16 places)" above the count caption. No network request. It can stay on in pick mode.
- Open: toggling the theme while the heatmap is on keeps the old `minOpacity` until the layer rebuilds.

### 2026-10-31: Replay your food year (Task 10, map features)
- `replayPlan.js`: `replayFrames(places)` gives one frame per local month, `{ key: '2026-03', label: 'Mar 2026', ids (cumulative place ids as strings), added }`, for located places with a valid `created_at` (others skipped). `replaySummary(places)` gives `{ places, dishes, areas (distinct areaKey), home (foodHome) }`.
- `FoodReplay.jsx` draws the overlay (month label, "+added" pill, place counter, Pause/Resume, Skip, X) and the end card (places, dishes, areas, food home, Close). Esc closes. `LeafletMap` got `children` (drawn over the map) and `frameOn` (markers to frame instead of `markers`).
- NearMe: a **Replay** chip in Map view (only with 2+ frames). Starting clears the selection, area card, crawl, pick mode and heatmap, hides the rail and list, and disables Plan a route and Heatmap while it runs. One frame per 900 ms; the map shows only that frame's journal pins (no wishes, no "you" dot, no distance ring). `frameOn` is the full set of pins, so the map frames once and never zooms per frame; panning never re-frames. No network requests. Leaving Map view or Close returns to the normal map. `prefers-reduced-motion`: straight to the end card with all pins. Starting scrolls the map into view (phones).
- Verified (Playwright, demo): months step with zoom and pan constant and 0 network requests; Pause holds the month, Resume continues, Skip and Esc and Close behave; reduced motion lands on the end card (72 places, 220 dishes, 32 areas, food home Alkapuri); 390 and 1280, light and dark.
- Open: a replay ignores the city, category and distance filters (it is your whole journal). A cluster bubble tap during replay just zooms in.

### 2026-10-31: Group map, who added it (Task 11, map features)
- In a group space each pin carries a small letter badge (`.mk-who`, top-right of the pin): the adder's first initial, "?" when the name is unknown. Hidden in Personal, and hidden on numbered crawl pins (the number wins). Halos, labels and the heat fade are untouched.
- "Added by" `ChipSelect` sits in the Near me control row, only in a group with 2+ distinct adders (you first as "You", unknown ids as "Someone"). It filters list and map (places and wishes by `user_id`) and, like the category chips, clears the area card and "Show these"; a planned crawl drops through the existing stale-plan check.
- Pure helpers `addedByOptions` / `adderInitial` in `src/mapInsights.js`. Journal passes `names`, `uid` (your id) and `group` to NearMe (`me` there is your position).
- Verified (Playwright, demo "Weekend Foodies"): the demo group has only one adder, so a second adder was simulated by rewriting the places response client-side (no DB writes): chip lists Everyone / You / Someone, Someone narrows list 7 to 2 and the map to 2 "?" pins; crawl pins show numbers without badges; Personal has no chip or badges; 390 and 1280, light and dark.
- If the selected adder disappears after a reload, an effect resets the filter to Everyone (it can't get stuck with its chip hidden).

### 2026-10-31: Map tiles and full screen (Task 12, map features) - Phase 3 complete
- `src/tiles.js`: `tileSource(dark)` gives CARTO Voyager (light) / Dark Matter (dark) with a linked OpenStreetMap + CARTO credit; `OSM_FALLBACK` is plain OSM. Voyager over the spec's Positron (roads and areas read better for finding food).
- `LeafletMap` picks the tiles from `document.documentElement.dataset.theme` (the app's own source, set in App.jsx) and swaps the layer live with a MutationObserver on `data-theme` (disconnected on unmount). After 4 `tileerror`s a module-level flag moves every map to OSM for the session. On OSM in dark mode the `.lmap.osm-dark` class brings back the old invert filter; the global dark filter is gone. All maps use this (still previews, PinPicker, Fix locations, MapSheet).
- **CARTO needs a key now (found 2026-10-31).** Every CARTO tile (Voyager, Dark Matter, light_all) is a 200 response carrying an "API KEY REQUIRED" watermark, so `tileerror` never fires and the fallback can't help. `CARTO_FREE = false` in `tiles.js` keeps the app on OSM (+ the dark invert) as before. Flip it to `true` if CARTO is keyless again; nothing else changes. Decision for the owner: stay on OSM, or find another keyless basemap.
- Full screen (Near me map only): a round `.nearfull` button top right (clear of the zoom control), aria-label "Full screen" / "Exit full screen", toggles `.nearmap-full` (fixed, inset 0, z-index 60, no radius, safe-area insets). It becomes the close button. `FullLayer` uses `useEscape` + `useScrollLock` from `layers.js`, so Esc closes only when it is the top layer and the page doesn't scroll behind. `LeafletMap` re-measures with a ResizeObserver on its container (robust for any size change, not only this one).
- Tapping a pin in full screen shows a floating `NearCard` (`pop`, with route line and time) inside the map (`.nearfloat`); the rail and area card are hidden behind the map, the replay overlay and crawl route still draw. The crawl bar sits in the hidden side column, so plan a route from the normal view.
- `.tabin` animation fill-mode changed from `both` to `backwards`: a held `transform` made it a containing block and trapped the fixed full-screen map inside the page.
- Verified (Playwright, demo): tiles swap live on theme toggle (no filter on CARTO); blocking `*.basemaps.cartocdn.com` falls back to OSM after the errors and dark mode gets the invert; full screen fills 390x844 and 1280x800, Esc and the X both close it, body scroll lock releases; PinPicker and the still preview show tiles. The CARTO tiles themselves only look native if CARTO is free (see above); the halo/ring/route/heat were not retuned because Dark Matter never rendered usable tiles.

### 2026-10-31: Guide, tour text, final check (Task 13, map features) - map features complete
- **Map features, in short:** share from Google Maps (Android installed app; iPhone and desktop still use Paste link), "Are you at ...?" one-tap exact spot, cluster bubbles with area summaries, pin labels when zoomed in, drive/walk time and route line, plan a food route (2 to 8 places, shortest order, opens Google Maps), heatmap and food home, replay your food year, Added by filter and initials in groups, full-screen map, swipeable card row (phone) or side list (desktop). Details sit in the Task 1 to 12 entries above.
- Feature guide (`features.js`): new items Share from Google Maps, Are you at ...?, Plan a food route, Food heatmap, Replay your food year (all with the `near` action); Groups text mentions Added by. `features.test.js` checks the guide mentions share, route, heatmap, replay and "are you at", and that every icon exists in `Icons.jsx`. Tour `near` scene now mentions travel time and planning a route.
- Bundle: main chunk was 879.55 kB (limit 853.7 kB), so per Ruling P4 `NearMe` is now `React.lazy` in `Journal.jsx` inside `Suspense` ("Loading the map..." in `--mute`). Main chunk is now 849.99 kB; NearMe is its own 29.16 kB chunk.
- **Known open items:** the real Android share-target flow is untested on a device (only simulated). CARTO tiles need an API key (see Task 12), so no new map style was added and the map look is unchanged. Replay ignores filters; theme toggle while the heatmap is on keeps old `minOpacity` until rebuilt.
- Final review fixes: in full screen a bubble tap zooms (no hidden area card); the category, Order again and Want to try chips clear the selection; replay text says "added"; tile notes now say OSM (dark = CSS invert).

### 2026-10-31: Moved from Vite to Next.js (single-page mode), branch `BiteMark/NextJS`
- **Kandarp asked for:** the whole project on Next.js, on the same Vercel project, with every feature working and the UI unchanged. Option A was chosen (single-page mode first). Option B, a real Next.js route per screen, comes later and is better for adding many screens.
- **Structure:**
  - `app/layout.jsx`: the old `index.html` head (metadata, viewport with `viewport-fit=cover`, theme colour, icons, manifest, preconnects, Figtree, iOS metas). It imports `src/index.css`.
  - `app/page.jsx` renders `app/ClientApp.jsx`. That imports `app/AppShell.jsx` (`ErrorBoundary` + `App` + `DialogHost`, i.e. what `main.jsx` mounted) normally, so its code downloads in parallel with Next's, but renders it only after mount (browser-only), and registers `/sw.js` after page load as before.
    - At first `next/dynamic` with `ssr: false` was used. The final review found it skips preload hints: app and Neon code (~190 kB gzip) downloaded only after Next's runtime. The fix gave cold +0.6 s and warm -0.1 s vs Vite.
    - Static import means `src/` modules are evaluated in Node at build time. `src/shareImage.js`'s `Path2D` is now made on first use.
    - `/share`: the share is stashed when `App.jsx` loads. The address is cleaned to `/` in App's first effect, after Next.js writes its own first history entry, keeping its history state.
  - `next.config.mjs` rewrites every path without a dot that isn't `/api/` or `/_next/` (`/:path((?!api/|_next/)[^.]+)`) to `/`, as the old `vercel.json` did. Unknown files and API paths still get a 404. so `/share` and `/reset-password` keep working with the URL intact. `/` stays a static page served from the CDN (a catch-all `[[...path]]` route rendered on every request).
  - `src/` is unchanged apart from `src/env.js`: `AUTH_URL` and `DATA_API_URL` from `NEXT_PUBLIC_NEON_AUTH_URL` and `NEXT_PUBLIC_NEON_DATA_API_URL`, with a fallback in `next.config.mjs` to the old `VITE_` names.
  - Gone: `index.html`, `src/main.jsx`, `vite.config.js`, `vercel.json`, `api/`, `dist/`. Tests use `vitest.config.js` (Vite stays only as Vitest's engine).
  - `agentRules: false`: no generated AGENTS.md (CLAUDE.md is the agent guide).
- **Commands:** `npm run dev` (port 5175), `npm run build` (writes `.next/`, gitignored), `npm start`, `npm test`.
- **Verified:**
  - Every screen: 72 screenshots before (Vite) and after (Next production build) of 18 states, at 390 and 1280 px, light and dark. 39 pairs are pixel-identical. The rest differ only in data or timing: same-timestamp card order, the demo group badge colour (the group's id changed after a demo reset), and a mid-animation card or share picture.
  - Features: Craving smart matching (transformers.js), bill scan (tesseract.js), voice, Near me (clusters, heatmap, route and time, crawl plan, replay, full screen, 3 km ring), `/share`, `/reset-password`, service worker and manifest, login labels, username login. 0 console errors.
- **Cost of Next.js** (measured; inherent to the framework):
  - First-visit JS is about 318 kB gzip, against 228 kB on Vite, because of Next's App Router runtime.
  - On slow 4G with 4x CPU, after the review fix: cold (no cache) 4.78 s vs 4.18 s (+0.6 s); warm (cached) 1.12 s vs 1.21 s (slightly faster).
