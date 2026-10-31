# Map Features (accuracy, smarter map, fun) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 13 map features of the spec in three phases: accuracy, a smarter map, and fun. All free.

**Architecture:**
- Pure logic lives in small tested modules (`shareTarget.js`, `hereNudge.js`, `route.js`, `mapInsights.js`, `crawl.js`, `replayPlan.js`, `tiles.js`, plus `geo.js` helpers).
- `LeafletMap.jsx` grows props for halos, clusters, labels, view changes, a route line, numbered stops, a heat layer, and theme tiles.
- `NearMe.jsx` composes them; new UI pieces are their own components.
- Accuracy writes only the existing `lat`, `lng`, `loc_source`, `maps_url` columns.

**Tech Stack:** React 19, Vite 8, Tailwind 4, Leaflet 1.9.4 with `leaflet.markercluster` (MIT) and `leaflet.heat` (BSD-2), lazy-loaded with Leaflet. OSRM demo (`router.project-osrm.org`), CARTO basemaps, Web Share Target. Vitest.

**Spec:** `docs/superpowers/specs/2026-10-31-map-features-design.md`

## Global Constraints

- **Free only:** no keys, no paid APIs.
- **External calls:**
  - OSRM is called only after a user action (tap or plan) and cached 10 minutes per place and rounded position.
  - Nothing is prefetched in bulk; tiles are never pre-downloaded.
- **Bundle:** the main bundle grows by at most about 5 KB. Leaflet plugins load inside `loadLeaflet()`.
- **Themed controls only:** every dropdown is `ChipSelect` (or the `.menu` look), never a native `<select>`. Check light and dark mode at 390 px and 1280 px.
- **Exact spots:** never overwrite an exact spot (`gps` | `link` | `pin`) without an explicit user action. Never present an area-level (≈) position as exact.
- **Database:** no new tables or columns. RLS is unchanged.
- **Windows:** never pair `foo.js` with `Foo.jsx` (the case clash). Preserve CRLF where a file has it.
- **Git:** Claude runs no git commands that change state. "Commit" steps are left to Kandarp.
- **Docs:** update `docs/frontend.md` (and `docs/backend.md` where relevant) at the end of each phase.

## Review Focus

1. **A share with no Google Maps link** (plain text, another app): the sheet says no place link was found, and still offers Add with the name. Tested in Task 1 (`parseSharedPlace` with text only).
2. **A share that arrives while logged out:** it's kept in sessionStorage and shown after login, never lost. Tested in Task 1 (`stashShare` / `takeShare`).
3. **OSRM offline, rate-limited, or answering `code != 'Ok'`:** the card keeps the straight-line distance, with no popup. Tested in Task 6 (`getRoute` returns null).
4. **A group place added by someone no longer in the group (no name):** "Someone" is shown, nothing crashes. Tested in Task 11 (`addedByOptions`).
5. **Replay or crawl with places missing positions or `created_at`:** those places are skipped. Tested in Task 10 (`replayFrames`) and Task 8 (`crawlStops`).

---

## Phase 1: Accuracy

### Task 1: Share from Google Maps → BiteMark

**Files:**
- Create: `src/shareTarget.js`, `src/shareTarget.test.js`, `src/ShareSheet.jsx`
- Modify: `public/manifest.webmanifest`, `src/App.jsx`, `src/Journal.jsx` (intent `prefill`, `wishPrefill`), `src/Wishlist.jsx` (`prefill` prop opens the form filled), `src/index.css`

**Interfaces:**
- Produces:
  - `parseSharedPlace({ title, text, url }) → { name, address, area, city, link }`
    - `link` is the first `https://maps.app.goo.gl/…` or `google.com/maps…` URL found in `url` or `text`, else `''`.
    - `name` is `title`, or else the first non-URL line of `text`.
    - `address` is the next non-URL line.
    - `city` is the address part matching a known city (passed in as the second argument `cities: string[]`), else `''`.
    - `area` is the address part just before the city, else `''`.
  - `rankMatches(shared, candidates) → candidates[]`
    - Ordered by name similarity, best first. A score of at least 0.6 is required; at most 3 are returned.
    - Candidates are `{ table, id, name, city, area, loc_source, group_id }`.
    - The name comparison uses the same folding as `geocode.js` (export `fold` from there).
  - `stashShare(storage, data)`, `takeShare(storage) → data | null` (key `bm.share`; the take removes it).

- [ ] **Step 1: Write failing tests** in `src/shareTarget.test.js`:
  - Google's real format, text `"Raj Rajeshwari Juice Centre\nFatehgunj Main Rd, Fatehgunj, Vadodara, Gujarat 390002\nhttps://maps.app.goo.gl/AbC123"`, with cities `['Vadodara','Ahmedabad']`, gives name `'Raj Rajeshwari Juice Centre'`, link `'https://maps.app.goo.gl/AbC123'`, city `'Vadodara'`, area `'Fatehgunj'`.
  - With `title` set, the title wins as the name. A link only in `url` is found.
  - Text only, no link: link `''`, name taken from the text.
  - `rankMatches`: "Raj Rajeshwari Juice Center" ranks the "Raj Rajeshwari Juice Centre" place first; "Coffea" isn't returned for it; at most 3; an exact-name match in the same city beats one in another city.
  - `stashShare` then `takeShare` round-trips; a second `takeShare` gives null; blocked storage gives null and never throws.
- [ ] **Step 2:** `npx vitest run src/shareTarget.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `src/shareTarget.js`.** Similarity is the share of folded name words that match, i.e. `|A∩B| / max(|A|,|B|)`, where "Centre" and "Center" fold alike.
- [ ] **Step 4:** Run again. Expected: PASS.
- [ ] **Step 5: Wire it in.**
  - **Manifest:** add `"share_target": { "action": "/share", "method": "GET", "params": { "title": "title", "text": "text", "url": "url" } }`.
  - **`App.jsx`:** before the reset-password check, if `location.pathname === '/share'`:
    - stash the `title`, `text` and `url` query params;
    - `history.replaceState(null, '', '/')`.
  - **After a session exists:**
    - `takeShare(sessionStorage)` and load candidates: `places` and `wishlist` `id, name, city, area, loc_source, group_id`, with `wishlist` limited to `went_at is null`.
    - Show `<ShareSheet>`.
  - **ShareSheet:**
    - resolves the link with `locationFromLink`, showing "Finding the exact spot…";
    - lists the top matches as "Save as the exact spot for {name}". Saving writes `{ lat, lng, loc_source: 'link', maps_url }` with `.eq('id')` and shows a toast "Exact spot saved for {name}";
    - **Add as a new place:** `go('journal')` + `setAddIntent({ prefill })`;
    - **Add to Want to try:** `go('wishlist')` + `setAddIntent({ wishPrefill })`;
    - with no link: "No Google Maps place link in what you shared" plus the two Add buttons, name only.
  - **Journal:**
    - `addIntent.prefill` → `setCreating({ prefill })`;
    - `addIntent.wishPrefill` → pass it to `<Wishlist prefill>`, which opens its form with those values.
  - The sheet uses the existing bottom-sheet look (`.sheet` classes used by FixLocations).
- [ ] **Step 6: Playwright.** Open `/share?text=<encoded Google text>&url=…` while logged in as Demo, with the link mocked by intercepting `/api/maps-resolve`:
  - the sheet lists the matching demo place;
  - Save writes `loc_source 'link'` (check through the Data API);
  - Add as a new place opens the form filled in.
  - Repeat while logged out: log in, then the sheet appears.
- [ ] **Step 7: Commit** (Kandarp): `feat(map): share a place from Google Maps into BiteMark`.

### Task 2: "Are you at …?"

**Files:**
- Create: `src/hereNudge.js`, `src/hereNudge.test.js`
- Modify: `src/NearMe.jsx` (keep `acc` from `getPosition`; render the card), `src/Journal.jsx` (pass `onSaved={load}` and `canEdit` to NearMe), `src/index.css`

**Interfaces:**
- Produces:
  - `NUDGE_REACH_M = 400`, `NUDGE_ACC_M = 50`
  - `nearbyGuess(items, me, dismissed: Set<string>) → item | null`, where `me = { lat, lng, acc }`. It returns the nearest item that:
    - has `loc_source === 'area'`;
    - is within 400 m;
    - has `kind` and `id` not in `dismissed` (key `` `${table}:${id}` ``);
    - and only when `me.acc <= 50`. Otherwise it returns null.
  - `dismissNudge(storage, key)`, `nudgeDismissed(storage) → Set` (localStorage `bm.nudge.no`).

- [ ] **Step 1: Failing tests:**
  - accuracy 80 gives null;
  - a ≈ place 300 m away is returned, 450 m away gives null;
  - exact places and places without a position are never returned;
  - with two candidates, the nearest wins;
  - a dismissed one is skipped;
  - storage round-trips, and blocked storage gives an empty Set.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement** using `distanceKm`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: UI.**
  - NearMe stores `me.acc`.
  - Above the results it shows a quiet card: "You're near {name}. Save where you are as its exact spot?" with **Save exact spot** / **Not now**.
    - Save does `update({ lat: me.lat, lng: me.lng, loc_source: 'gps' }).eq('id', id)` on `item.table`, then `onSaved()`.
    - Not now calls `dismissNudge`.
  - Only items the user can edit (`canEdit(item)` from Journal) are offered.
- [ ] **Step 6: Playwright** (demo): mock the geolocation 200 m from a demo ≈ place with accuracy 20. The card shows; Save turns the pin solid.
- [ ] **Step 7: Commit:** `feat(map): offer to save the exact spot when you're at a place`.

### Task 3: Halo on ≈ pins

**Files:** Modify `src/LeafletMap.jsx` and `src/index.css`.

**Interfaces:** Produces the LeafletMap behaviour: markers with `approx: true` get an `L.circle` of `APPROX_HALO_M = 300` (exported from `geo.js`), class `lmap-halo`, shown only while `map.getZoom() >= 14` (toggled on `zoomend`).

- [ ] **Step 1: Failing test** in `geo.test.js`: `APPROX_HALO_M` is 300, and `showHalo(zoom)` is true at 14, false at 13.
- [ ] **Step 2:** Run (FAIL). **Step 3:** Implement `showHalo` and the halo layer. **Step 4:** Run (PASS).
- [ ] **Step 5: Playwright.** At zoom 15, a ≈ pin has a dashed halo; at zoom 12 it doesn't. Light and dark.
- [ ] **Step 6:** Update `docs/frontend.md` (Phase 1 section). **Commit:** `feat(map): show how approximate a ≈ pin is`.

## Phase 2: A smarter map

### Task 4: Cluster bubbles + area summary

**Files:**
- Create: `src/mapInsights.js`, `src/mapInsights.test.js`, `src/AreaCard.jsx`
- Modify: `package.json` (add `leaflet.markercluster@1.5.3`), `src/LeafletMap.jsx` (`cluster`, `onCluster(ids)`), `src/NearMe.jsx`, `src/index.css`

**Interfaces:**
- Produces:
  - `areaKey(p) → string`: the last comma or slash part of `p.area`, folded to lower case, else `''`.
  - `areaSummary(items) → { name, count, avg, best: { dish, place } | null }`:
    - `name` is the most common display area among the items (ties: the first);
    - `avg` is the mean of the places' best dish ratings, to 1 decimal, or null;
    - `best` is the highest-rated dish (ties: most recent).
  - LeafletMap `cluster` prop (bool). Clustering uses `L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50, iconCreateFunction })`. The icon is `<span class="mk-cluster">{n}</span>`.
  - `onCluster(ids: string[])` is called on a cluster tap instead of zooming. The blue dot and the selected marker are added outside the cluster group.

- [ ] **Step 1: Failing tests** in `mapInsights.test.js`:
  - `areaKey({area:'Express Hotel, Alkapuri'})` is `'alkapuri'`;
  - `areaSummary` on 3 Alkapuri places with ratings 5/4/3 and one Sayajigunj place gives name `'Alkapuri'`, count 4, the correct avg, and best is the 5★ dish with its place name;
  - wishes (no dishes) are counted but don't affect avg;
  - an empty list gives `{count:0, avg:null, best:null}`.
- [ ] **Step 2:** Run (FAIL). **Step 3:** Implement. **Step 4:** Run (PASS).
- [ ] **Step 5: UI.**
  - NearMe passes `cluster` in Map view.
  - On a cluster tap, `AreaCard` shows "Alkapuri · 9 places · 4.3★ average · best: Masala dosa at Sankalp" with **Zoom in** (fits those markers) and **Show these** (a list filter by ids, cleared by ×).
- [ ] **Step 6: Playwright** (demo, 72 pins): bubbles appear at zoom 12; tapping one shows the AreaCard; Zoom in splits it. `npm run build` shows the plugin in the lazy Leaflet chunk, not the main bundle.
- [ ] **Step 7: Commit:** `feat(map): cluster bubbles with area summaries`.

### Task 5: Readable pins (name and dish labels)

**Files:** Modify `src/geo.js`, `src/geo.test.js`, `src/LeafletMap.jsx`, `src/NearMe.jsx` (markers get `label`, `sub` = must-try), `src/index.css`.

**Interfaces:**
- `labelLevel(zoom) → 0 | 1 | 2`: 0 below 15, 1 at 15, 2 at 16 and up.
- LeafletMap sets the class `lbl-1` / `lbl-2` on its container on `zoomend`.
- The marker HTML includes `<b class="mk-name">label</b><small class="mk-sub">sub</small>`; CSS shows them by level.

- [ ] **Steps 1–4:** TDD `labelLevel` (14 → 0, 15 → 1, 16 → 2, 18 → 2).
- [ ] **Step 5:** CSS: labels have a surface background and are ellipsised at 140 px, and are hidden for the selected pin (its card shows the same thing).
- [ ] **Step 6:** Playwright at zoom 16: names and dishes are readable in both themes. **Commit:** `feat(map): pin labels with must-try dish`.

### Task 6: Real travel time + route line

**Files:**
- Create: `src/route.js`, `src/route.test.js`
- Modify: `src/LeafletMap.jsx` (`route` prop: an array of `[lat,lng]` drawn as `L.polyline`, class `lmap-route`), `src/NearMe.jsx` (NearCard trip line), `src/index.css`

**Interfaces:**
- `routeUrl(from, to) → string`: `https://router.project-osrm.org/route/v1/driving/{lng},{lat};{lng},{lat}?overview=full&geometries=geojson`.
- `parseRoute(json) → { km, min, line } | null`: null unless `code === 'Ok'`. `km` = distance/1000; `min` = round(duration/60), at least 1; `line` = coordinates flipped to `[lat,lng]`.
- `walkMinutes(km) → number`: round(km / 4.8 × 60), at least 1.
- `tripLabel({ km, min }, approx) → string`: e.g. `"14 min drive · 3.8 km by road"`, with `"≈ "` in front when approx. Under 1 km, `"850 m by road"`.
- `getRoute(from, to, { fetchFn = fetch, now = Date.now }) → Promise<route | null>`:
  - module cache keyed by `from` rounded to 3 decimals plus `to`, with a 10-minute TTL;
  - errors and non-Ok answers give null.

- [ ] **Step 1: Failing tests:**
  - URL format (lng before lat);
  - `parseRoute` on a fixture `{code:'Ok', routes:[{distance:3280.1,duration:198.5,geometry:{coordinates:[[73.18,22.31],[73.19,22.32]]}}]}` gives `{km:3.2801, min:3, line:[[22.31,73.18],[22.32,73.19]]}`;
  - a non-Ok answer gives null;
  - `walkMinutes(2.4)` is 30;
  - labels for 3.8 km / 14 min, 0.85 km, and approx;
  - `getRoute`:
    - a second call within 10 minutes doesn't fetch again;
    - a call after 11 minutes fetches again;
    - a throwing fetch gives null.
- [ ] **Steps 2–4:** FAIL, implement, PASS.
- [ ] **Step 5: UI.**
  - When `sel` changes and `me` is known, call `getRoute(me, place)`.
  - The card shows the trip label and "· {walkMinutes} min walk"; Map view passes `route={line}`.
  - On null, show nothing extra (the straight-line chip stays).
- [ ] **Step 6:** Playwright: tapping a pin draws the route and the card shows "min drive". With OSRM blocked by a route intercept, there's no error and the card still shows. **Commit:** `feat(map): road travel time and route line`.

### Task 7: Map and list in step

**Files:** Modify `src/geo.js` (+test), `src/LeafletMap.jsx` (`onView(bounds)` on `moveend`, with `{south, west, north, east}`), `src/NearMe.jsx`, `src/index.css`.

**Interfaces:**
- `inBounds(items, b) → items` (inclusive edges; no-position items are excluded).
- **Map view:**
  - Phones (< 1024 px): under the map, `.nearrail`, a horizontal scroll-snap row of `NearCard`s for `inBounds(shown, view)`.
    - An IntersectionObserver (threshold 0.6) sets `sel` to the centred card.
    - A pin tap scrolls its card into view.
  - Desktop: `.nearsplit` grid, map 3fr and list 2fr (scrolling, max-height of the map). Hovering a list card highlights its pin; a pin tap scrolls to it.
  - Caption: `"{n} places in this area"` when the view is narrower than all pins, else the existing caption.

- [ ] **Steps 1–4:** TDD `inBounds` (inside, edge, outside, no coordinates).
- [ ] **Step 5:** Implement the UI. Panning never calls fit, since fit stays keyed on `boundsKey`.
- [ ] **Step 6:** Playwright at 390 px (rail swipe selects a pin; pin tap scrolls the rail) and 1280 px (side list in step). **Docs (Phase 2)** + **Commit:** `feat(map): map and list move together`.

## Phase 3: Unique and fun

### Task 8: Food crawl planner

**Files:**
- Create: `src/crawl.js`, `src/crawl.test.js`, `src/CrawlBar.jsx`
- Modify: `src/LeafletMap.jsx` (markers may carry `num` → numbered pin), `src/NearMe.jsx`, `src/index.css`

**Interfaces:**
- `CRAWL_MIN = 2`, `CRAWL_MAX = 8`.
- `crawlStops(items) → items`: keeps located items only, max 8.
- `tripServiceUrl(start, stops) → string`: `https://router.project-osrm.org/trip/v1/driving/{coords}?roundtrip=false&source=first&destination=any&overview=full&geometries=geojson`. `start` is the user (or the first stop when null).
- `parseTrip(json, stops, hasStart) → { order: stops[], km, min, line } | null`: uses `waypoints[i].waypoint_index`, dropping the start point when `hasStart`.
- `googleDirectionsUrl(origin, ordered) → string`:
  - `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=…&waypoints=a|b`;
  - plus `&origin=lat,lng` when there is an origin;
  - each stop is `lat,lng` when `isExact`, else `encodeURIComponent("name, area, city")`.

- [ ] **Step 1: Failing tests:**
  - `crawlStops` drops unlocated items and caps at 8;
  - the URL format;
  - `parseTrip` on a 3-stop fixture with `waypoint_index` [0,2,1,3] (the start first) gives the reordered stops;
  - `googleDirectionsUrl` mixes coordinates for exact stops and text for ≈ ones, uses the last stop as destination, and joins waypoints with `|` (encoded `%7C`);
  - fewer than 2 stops gives null.
- [ ] **Steps 2–4:** FAIL, implement, PASS.
- [ ] **Step 5: UI.**
  - In Map view, a chip **Plan a route** enters pick mode: pins and cards toggle membership, and pins show their number.
  - `CrawlBar` (sticky under the map): "{n} stops" with **Plan** (calls `getRoute`-style fetch with the trip URL, cached the same way) → shows "Best order · 42 min · 11.3 km", draws the line, renumbers the pins, and offers **Open in Google Maps** and **Clear**.
  - With fewer than 2 stops, Plan is disabled with the title "Pick at least 2 places".
- [ ] **Step 6:** Playwright (demo): pick 3 Want to try places, Plan, numbered route, and the Google URL has 1 waypoint plus a destination. **Commit:** `feat(map): food crawl planner`.

### Task 9: Food heatmap + food home

**Files:** Modify `package.json` (add `leaflet.heat@0.2.0`), `src/mapInsights.js` (+test), `src/LeafletMap.jsx` (`heat` prop), `src/NearMe.jsx`.

**Interfaces:**
- `heatPoints(places) → [lat, lng, w][]`: `w = min(1, dishes.length / 6)`, at least 0.2; located places only.
- `foodHome(places) → { name, count } | null`: the most frequent `areaKey` (shown in the display spelling) among your places, with at least 2 places.
- The LeafletMap `heat` layer uses `L.heatLayer(points, { radius: 28, blur: 22, minOpacity: .25, gradient: {0.3:'#f5c26b', 0.6:'#f26b1d', 1:'#b8541a'} })`.

- [ ] **Steps 1–4:** TDD: weights (0 dishes → 0.2, 3 → 0.5, 9 → 1), unlocated skipped, `foodHome` with a tie (the first), and null under 2.
- [ ] **Step 5:** A toggle chip **Heatmap** in Map view. While it's on, pins fade to 35 % opacity, and the caption says "Your food home: Alkapuri (9 places)".
- [ ] **Step 6:** Playwright in both themes. **Commit:** `feat(map): food heatmap`.

### Task 10: Replay your food year

**Files:**
- Create: `src/replayPlan.js`, `src/replayPlan.test.js`, `src/FoodReplay.jsx` (the name avoids a replay.js / Replay.jsx case clash)
- Modify: `src/NearMe.jsx`

**Interfaces:**
- `replayFrames(places) → [{ key: 'YYYY-MM', label: 'Mar 2026', ids: string[] /* cumulative */, added: number }]`: located places with a valid `created_at`, sorted by month.
- `replaySummary(places) → { places, dishes, areas, home }`: `areas` is the number of distinct `areaKey`s; `home` comes from `foodHome`.
- **FoodReplay:**
  - a **Play** button on the map;
  - one frame every 900 ms, with the month label and "+{added}" pill;
  - Pause, and Skip (to the end);
  - at the end, a summary card;
  - with `prefers-reduced-motion`, it goes straight to the end.
  - The map shows only `frame.ids` while playing.

- [ ] **Steps 1–4:** TDD:
  - 3 places across Jan and Mar give 2 frames, with cumulative ids and labels;
  - a place with no position or a bad date is skipped;
  - the summary counts.
- [ ] **Step 5:** Implement the UI. Fit stays fixed to the full set during play (no zooming per frame).
- [ ] **Step 6:** Playwright: Play shows the months; Skip shows the summary. **Commit:** `feat(map): replay your food year`.

### Task 11: Group map (who added it)

**Files:** Modify `src/mapInsights.js` (+test), `src/Journal.jsx` (pass `names`, `me`, `group` to NearMe), `src/NearMe.jsx`, `src/LeafletMap.jsx` (marker `initial` → small badge), `src/index.css`.

**Interfaces:**
- `addedByOptions(items, names, me) → [['', 'Everyone'], [id, name] …]`:
  - you first, as "You";
  - unknown ids as "Someone", with ids kept distinct;
  - only people who added something.

- [ ] **Steps 1–4:** TDD: ordering, unknown name, duplicates collapsed.
- [ ] **Step 5:**
  - In a group space, the markers carry `initial` (the first letter of the name, or "?") with a badge on the pin.
  - A `ChipSelect` "Added by" filter (label "Added by") sits in the chip row and filters list and map.
  - Hidden in Personal.
- [ ] **Step 6:** Playwright in the demo group "Weekend Foodies". **Commit:** `feat(map): group map shows who added each place`.

### Task 12: CARTO tiles + full screen

**Files:**
- Create: `src/tiles.js`, `src/tiles.test.js`
- Modify: `src/LeafletMap.jsx`, `src/NearMe.jsx`, `src/index.css` (remove the dark tile invert filter)

**Interfaces:**
- `tileSource(dark) → { url, attribution, subdomains }`:
  - light: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`;
  - dark: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`;
  - subdomains `'abcd'`;
  - attribution: `'© OpenStreetMap, © CARTO'` (both linked).
  - **Ruling:** Voyager instead of the spec's Positron, because it shows roads and areas more clearly for finding food. Cost if wrong: one URL.
- `OSM_FALLBACK`: the current OSM tile source.
- **LeafletMap:**
  - watches `document.documentElement[data-theme]` with a MutationObserver and swaps the tile layer;
  - after 4 `tileerror`s, switches to `OSM_FALLBACK` for the session.
- **Full screen:** a button on the Near me map (top right, under the zoom controls). It toggles `.nearmap-full` (`position:fixed; inset:0; z-index:60`), calls `invalidateSize`, and closes with Esc or ×.

- [ ] **Steps 1–4:** TDD `tileSource` (both themes, attribution contains both credits) and `OSM_FALLBACK`.
- [ ] **Step 5:** Implement the UI. Remove `:root[data-theme="dark"] .lmap .leaflet-tile-pane{filter:…}`.
- [ ] **Step 6:**
  - Playwright: the light and dark maps look native, with no inverted colours.
  - Blocking CARTO falls back to OSM.
  - Full screen works on a phone and Esc closes it.
  - `docs/frontend.md` and `docs/backend.md` (Phase 3: external services list).
  - **Commit:** `feat(map): proper light/dark map tiles and full screen`.

### Task 13: Guide, tour text, final check

**Files:** Modify `src/features.js` (+test), `src/tourPlan.js` (near scene text mentions the route), the docs.

- [ ] **Step 1:** Failing `features.test.js` check: the guide mentions "share", "route" and "heatmap".
- [ ] **Step 2:** Add Feature guide items:
  - **Share from Google Maps:** Android: Share → BiteMark saves the exact spot.
  - **Plan a food route.**
  - **Food heatmap.**
  - **Replay your food year.**
  Each has a `near` action where it applies. Run (PASS).
- [ ] **Step 3:** Full run: `npx vitest run` (all pass) and `npm run build` (main bundle within +5 KB of 848.7 kB).
- [ ] **Step 4:** Whole-branch review (fresh reviewer, most capable model). Fix Critical and Important findings with TDD, and ledger the minors.
