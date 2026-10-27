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
| `useGestures.js` (+`gestures.js`), `Toast.jsx` (+`undo.js`), `StoryCard.jsx` (+`foodStory.js`) | Phone polish: swipe-to-close sheets, pull to refresh, Undo toast, the "food story" in the You sheet. |
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
- **Account:** username `test`, password `test1234`, email `demo@example.com` (a reserved domain, so mail can't reach a real person). Created through the app's normal sign-up on 2026-10-29 (no email verification needed).
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
