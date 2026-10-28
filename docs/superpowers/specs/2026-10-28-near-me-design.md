# Near me: exact place locations and "Places near me"

Branch `BiteMark/Near_Me`, cut from origin/main 69c3e38. Agreed with the user on 2026-10-28.

## Why

The Maps feature that exists today stores only a Google Maps link, or searches Google Maps for the name and area. The app never knows where a place actually is. The user wants two things:
- exact positions for places, with "perfect latitude/longitude";
- a **Places near me** screen: turn on location, see the places already reviewed and saved around you.

Hard constraint: **totally free**. No API keys, no billing account, no paid tiers.

## Decisions (the user's)

1. **How a place gets its position: A + B + C**
   - **A. "I'm here":** the phone's GPS, one tap, when you're at the restaurant.
   - **B. Pin on a map:** search, then drag a pin onto the building. It works from anywhere.
   - **C. Read it from a pasted Google Maps link**, including short `maps.app.goo.gl` links.
2. **Near me screen: C.** A **List / Map** toggle, with the list as the default.
3. **Places saved before this feature: C.** A guided **Fix locations** review. It shows a guessed pin, and you confirm it, drag it, or skip. Nothing guessed is saved without the user seeing it.
4. **What Near me shows: B.** The space you're in (Personal or the open group) plus that space's Want to try list.

## Goals

- Every place and Want to try entry can hold an exact `lat` / `lng`, set by any of A, B or C.
- Near me lists the current space's places and wishes with a position, nearest first, with distances. The map shows the same results as pins around a "you are here" dot.
- In Near me:
  - a distance chip: 1 / 3 / 5 / 10 km;
  - the category filter and an Order again filter, applied to both the list and the map;
  - **Directions**, which opens Google Maps navigation to the exact coordinates.
- Fix locations walks through the places that have no position.
- The demo journal (72 places) gets coordinates, so Near me works in the demo.
- Works on phone and laptop, in light and dark mode, and with the keyboard.

## Non-goals

- Live tracking, background location, or notifications ("you're near X").
- Storing the user's own position anywhere. It stays in the browser's memory while Near me is open.
- Turn-by-turn navigation inside the app. Google Maps does that.
- Clustering or heat maps. Journals are tens to a few hundred places.

## Anti-goals (a failure even if it works)

- A paid or keyed service, or a free tier that silently starts billing.
- A guessed position saved as if it were exact.
- Asking for location permission before the user opens Near me or taps "I'm here".
- The map library making the first page load slower. It loads only when a map is opened.

## Constraints and the free stack

- **Map:** Leaflet 1.9.4 (open source), with OpenStreetMap tiles from `tile.openstreetmap.org`.
  - Attribution "© OpenStreetMap" is always visible, as the OSM tile policy requires.
  - Dark mode darkens the tiles with a CSS filter, so no second tile provider is needed.
- **Search and guesses:** Photon (`photon.komoot.io`, OpenStreetMap data). It's free, needs no key and allows CORS.
  - Requests are made only when the user acts: typing in search (debounced 400 ms) or stepping through Fix locations. That is far below fair use.
- **The user's position:** the browser's Geolocation API.
- **Distances:** the haversine formula on the device. No PostGIS needed.
- **Short links:** `api/maps-resolve.js`, a Vercel function on the free plan, follows the `maps.app.goo.gl` redirect.
  - It accepts only Google short-link hosts and only follows redirects to Google hosts, so it can't be used to fetch arbitrary URLs.
  - It returns the final URL; the app reads the coordinates from it.
- **Database:** `lat double precision`, `lng double precision`, `loc_source text` on `places` and `wishlist`.
  - Constraints: both coordinates are set or both are null; latitude is −90…90 and longitude −180…180; `loc_source` is one of `gps`, `link`, `pin`.
  - Existing row-level policies cover the new columns.
  - Like `maps_url`, the app still saves everything else if the migration hasn't run yet.

## How each part behaves

### Location in the forms (place form and Want to try form)

A "Location" block sits under the Google Maps link field.
- **Status line:**
  - "No exact location yet", or
  - "📍 Exact location set", with how it was set (GPS ±8 m / from the Maps link / pinned on the map) and a small map preview.
- **Buttons:** **I'm here** and **Set on map** (or **Adjust** once set), plus **Remove**.
- **I'm here** asks for one high-accuracy GPS reading (timeout 15 s).
  - At or under 50 m, the position is set.
  - Worse than 50 m, it says "Only accurate to ±120 m. Try again outdoors, or fix it on the map" and opens the pin map at that spot.
  - If permission is refused, it explains how to turn location on, and the pin map remains an alternative.
- **Pasting a Google Maps link** reads the coordinates straight away.
  - Full links: the place's `!3d…!4d…` pair is preferred over the map-centre `@lat,lng`; `q=` / `query=` / `ll=` / `destination=` are also read.
  - Short links go through `api/maps-resolve`.
  - If the link has no coordinates (only a place ID), it says so and offers the pin map. If a position is already set, the link never overwrites it silently: "Use the link's location?" is asked.
- **Set on map** opens a full-height sheet:
  - a search box with Photon suggestions, biased to the typed city;
  - a draggable pin, which is also moved by tapping the map;
  - **Use this spot**.
  - It starts at the current pin, else the typed name/area/city guess, else the typed city, else India.

### Near me (new view `near`)

- **Laptop:** "Near me" in the sidebar under Browse.
- **Phone:** a third quick tile next to "Craving?" and "Where to eat?". The bottom bar is already full.
- Opening it asks for the position once. A refresh button asks again.
- Chips: distance 1 / 3 / 5 / 10 km (default 5), categories, Order again, and "Want to try".
- **List:**
  - Cards show the distance ("850 m"), the name, the area, and the best dish or note.
  - Want to try entries have a bookmark badge.
  - Tapping a journal place opens its details; tapping a wish opens Directions.
  - When nothing is in range: "Nothing within 3 km", with a "Show 10 km" button.
- **Map:**
  - a blue dot for you;
  - round pins coloured by the place's best rating, and bookmark pins for wishes;
  - tap a pin for a popup with the name, the distance, the must-try dish and **Directions**.
- The banner "12 places need a location · Fix now" opens Fix locations.
- **Error states:** permission denied (with how to fix it), location unavailable, and no places with a position yet.

### Fix locations

- A sheet that goes through the current space's places with no position, one at a time ("3 of 12").
- Each place shows a small map with a pin at Photon's best guess for "name, area, city". If there's no guess, the pin starts at the area or city and is labelled "Couldn't find it: drag the pin".
- Actions:
  - **Looks right:** saves the position with `loc_source='pin'`.
  - Drag the pin, then **Use this spot**.
  - **Skip.**
- Finishing shows a short summary.

### Elsewhere

- The Maps button and address links open the exact coordinates when a place has them, unless a Maps link was saved, which still wins.
- **Directions** URL: `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`.
- Demo seed: each of the 72 places gets coordinates, looked up once with Photon/Nominatim and checked against the area.
  - Places that can't be found precisely get the area's centre, and that is recorded in `db/demo` as approximate.
  - `reset_demo()` inserts them.

## Left to the builder (my calls)

- File and component names, pin styling, and the exact copy.
- The 50 m GPS threshold, the 5 km default distance and the 400 ms search debounce.
- Leaflet is loaded with a dynamic `import()` the first time a map opens.
