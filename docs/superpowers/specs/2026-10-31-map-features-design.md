# BiteMark map features: accuracy, a smarter map, and fun (design)

Date: 2026-10-31 · Branch: `BiteMark/Near_Me` (continues the Near me work) · Status: for approval

## Intent

Kandarp asked for "too accurate" maps with every useful, unique and catchy map feature that can be
had **free** (no paid API, no key that needs a card). He chose option A: everything, built in three
phases. Accuracy goes first, because every other map feature is only as good as the pins.

Why now: Near me works, but 39 of his 45 places have no position (OpenStreetMap doesn't know their
landmarks), area-level pins can be about 500 m off, 72 demo pins pile up in one area, and the map
only displays. It doesn't help you decide, plan or discover.

## Goals

- Many more places with an **exact** position, with little effort from the user.
- A map that **reads** well with many pins, says how far a place really is (road time, not straight
  line), and stays in step with the list.
- Features no other personal food journal has: a food crawl planner, a food heatmap, and a replay
  of your food year.

## Non-goals and anti-goals

- No paid or keyed services: no Google Places, Mapbox or Here.
- No background tracking or alerts with the app closed. Web apps can't do it, and it would feel creepy.
- Never move an exact spot without the user saying so. Never show a guess as if it were exact.
- Don't slow the app's first load. Map code and plugins load only when a map opens.
- Don't crowd the Near me screen. New tools sit behind small controls on the map, in BiteMark's own
  theme. Every dropdown and menu uses ChipSelect or the `.menu` look, never a native `<select>`.

## Research findings that shaped this

- **Accuracy.** OpenStreetMap lists only about 127 named food places in all of Vadodara (339 in
  Ahmedabad). Matching his 45 places by name against them found 2, and both were chains with
  several branches. So "snap to the real shop" and "discover untried OSM spots nearby" were
  **dropped**: they would mostly disappoint. Google's own link is the only free source of exact
  spots, so the plan makes getting that link effortless.
- **Free services, all checked live from the browser:**
  - OSRM demo route and trip service: works with CORS. Driving profile. Fair use is light, one
    request when you tap a place.
  - CARTO basemaps (Positron / Dark Matter): reachable, free with attribution for this kind of use.
  - Leaflet.markercluster (MIT) and Leaflet.heat (BSD-2): npm, free.
  - Web Share Target: supported by Chrome on Android for installed web apps. Not on iPhone, where
    the existing copy-link flow stays.
- **Other apps:** Mapstr has shared maps, a visits journal and proximity alerts. Google Maps has
  lists and a Timeline grouped by place and city. Airbnb and Zomato keep map and list in step.

## The features

### Phase 1: Accuracy

1. **Share from Google Maps to BiteMark.**
   - The installed app (Android) appears in Google Maps' Share sheet. This uses the
     `share_target` entry in `manifest.webmanifest` with GET parameters `title`, `text` and `url`,
     opening a route like `/share`.
   - BiteMark reads the shared text. Google sends the place name, the address and a
     `maps.app.goo.gl` link. The existing `/api/maps-resolve` turns the link into exact coordinates.
   - A sheet asks what to do:
     - **"Save as the exact spot for …"**: the best name matches among your places and Want to
       try, any space, most likely first.
     - **Add as a new place**: opens the form pre-filled with the name, area from the address,
       city, and the exact location.
     - **Add to Want to try**: pre-filled the same way.
   - If you're not logged in, the share is kept until you log in.
   - On iPhone and desktop, nothing changes (Find on Google Maps → Paste link).
2. **"Are you at …?"**
   - On Near me, when your GPS fix is good (≤ 50 m) and a place with only an area-level (≈)
     position is close by, a quiet card offers "You're near Raj Rajeshwari. Save where you are as
     its exact spot?" Close by means within 400 m of its ≈ position: the area guess's typical error.
   - Choosing Yes saves `loc_source 'gps'`. Choosing No hides it for that place on this device.
   - At most one card at a time, nearest first. Places with no position at all can't be offered,
     because we don't know they're near.
3. **Honest accuracy on the map.** Area-level (≈) pins get a faint dashed halo of about 300 m when
   zoomed in (zoom ≥ 14), so it's visible that "it's somewhere around here". Exact pins stay solid.

### Phase 2: A smarter map

4. **Clusters.**
   - Crowded pins merge into a count bubble in BiteMark's colours that splits as you zoom in.
   - Your blue dot and the selected pin never cluster.
   - Tapping a bubble shows its **area summary** (feature 8) with a "Zoom in" button.
5. **Readable pins.** At zoom ≥ 15, each pin shows its place name as a small label, and the must-try
   dish too at zoom ≥ 16. Labels never cover the selected card.
6. **Map and list in step.** In Map view, what you see drives the list:
   - **Phones:** a swipeable row of cards under the map, covering the places in view, nearest
     first. Swiping highlights the pin, and tapping a pin scrolls to its card.
   - **Desktop:** the map with a scrolling list beside it, kept in step the same way.
   - The caption says "8 places in this area". Panning updates it; it doesn't re-frame the map.
7. **Real travel time and route.**
   - Tapping a place (card or pin) asks OSRM for the driving route from you.
   - The card shows "14 min drive · 3.8 km by road", and the route is drawn as a line on the map.
   - Walking time is estimated from the road distance at 4.8 km/h.
   - Only one request per tap, cached per place and your rounded position for 10 minutes.
   - Without your location, or if OSRM fails, the straight-line distance stays and nothing breaks.
   - For ≈ places, the time is marked "≈".
8. **Area insights.**
   - An area is the places sharing the same normalised landmark word (e.g. Alkapuri) or one
     cluster bubble.
   - The summary reads "Alkapuri · 9 places · 4.3★ average · best: Masala dosa at Sankalp", with a
     button to filter the list to them.

### Phase 3: Unique and fun

9. **Food crawl planner.**
   - In Map view, "Plan a route" lets you pick 2–8 places (Want to try or journal).
   - OSRM's trip service orders them shortest-first, starting from you, or from the first pick if
     there's no location.
   - The route is drawn with numbered stops, plus total time and distance.
   - "Open in Google Maps" builds a free directions URL with waypoints: coordinates for exact
     places, the "name, area, city" text for ≈ places.
10. **Food heatmap.**
    - A map toggle shows a warm glow over where you eat, weighted by the number of dishes you
      logged at each place.
    - The caption names your "food home", the area with the most places (e.g. "Your food home:
      Alkapuri").
11. **Replay your food year.**
    - A play button on the map drops your pins in the order you added them, month by month, with
      a month label and a counter.
    - It ends on a summary card: places, dishes, new areas, and your food home.
    - It can be paused and skipped, and respects reduced motion (it shows the end state at once).
12. **Group map.**
    - In a group space, each pin carries the initial of who added it.
    - A ChipSelect "Added by" filter (Everyone / each member) narrows the map and list.
13. **Map style and full screen.**
    - Light mode uses CARTO Positron and dark mode CARTO Dark Matter, which is a real dark map
      instead of today's colour-inverted OSM tiles. It falls back to OSM tiles if CARTO fails.
    - A full-screen button on the Near me map.
    - The attribution changes to "© OpenStreetMap, © CARTO".

### Explicitly not built

- Alerts while the app is closed (not possible for web apps).
- Google ratings, photos and opening hours (paid).
- Satellite view (no clean free source).
- OSM shop snapping and "discover untried nearby": OSM's food data here is too thin (see Research).

## Constraints

- Free only. Services: OSRM demo (`router.project-osrm.org`), CARTO basemaps, plus the existing
  Photon, Nominatim, OSM tiles and `/api/maps-resolve`.
- Fair use:
  - OSRM is called only after a user action (tap, plan) and cached.
  - Nothing is prefetched in bulk.
  - Tiles are never pre-downloaded.
- Leaflet plugins are lazy-loaded with Leaflet. The main bundle must not grow by more than about
  5 KB.
- **Database:** no new tables. Accuracy features write the existing `lat`, `lng`, `loc_source`
  (`gps`, `link`) and `maps_url`, with the existing RLS. Group map uses `places.user_id` and
  `profiles.display_name`, which Journal already loads in a group space.
- **Same app rules:**
  - TDD for all pure logic;
  - Playwright checks at 390 px and 1280 px, light and dark;
  - themed controls only;
  - FE and BE docs updated;
  - no git actions by Claude.

## Decided by Kandarp

- Scope A: all features, in three phases, accuracy first.
- Everything free; themed UI only; earlier Near me decisions stand (city chips, the 1–10 km
  distance filter, List and Map).

## My calls (please check)

- I replaced "snap to the real shop" and "discover untried spots" with **Share from Google Maps**,
  based on the 2/45 measurement.
- "Are you at …?" uses a 400 m reach and a 50 m GPS accuracy bar.
- Driving is the default travel mode (OSRM demo), and walking is estimated from road distance.
- The crawl allows 2–8 stops (Google's free URL takes up to 9 waypoints).
- The heatmap is weighted by the number of dishes logged.
- The replay steps month by month, using the date each place was added.
- CARTO tiles replace OSM tiles in both themes, with OSM as fallback.

## Left to the builder

- Exact visual styling within BiteMark's tokens.
- Cluster radius.
- Label collision handling.
- Animation timings.
- How the share route is wired into the existing App routing.
- Component and file split.
