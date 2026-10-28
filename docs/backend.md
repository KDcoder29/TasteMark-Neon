# BiteMark — Backend scope

Everything server-side: Neon Postgres (schema, RLS, RPCs, triggers), Neon Auth, the Data API, the Vercel functions in `api/`, and the one-off scripts in `scripts/`.

> Update this file whenever a backend decision is made or a task finishes. Newest decision log entries go first.

## Current architecture

| Piece | What it is | Where |
|---|---|---|
| Database | Neon Postgres. Every table has row-level security (RLS) enabled. | `db/neon-schema.sql` (idempotent, so you can re-run it) |
| Auth | Neon Auth (Better Auth). Users are in `neon_auth."user"` and `auth.uid()` returns the caller. | Neon Console |
| Data API | PostgREST-style API. The browser calls it through `@neondatabase/neon-js`. | `VITE_NEON_DATA_API_URL` |
| Serverless | Vercel functions. In dev, `vite.config.js` (`apiDev` plugin) runs them. | `api/*.js` |
| Scripts | One-off Node jobs. They connect directly with `pg`. | `scripts/*.mjs` |

### Tables
`profiles`, `groups`, `group_members`, `places`, `dishes`, `dish_ratings`, `dish_reactions`, `dish_comments`, `wishlist`, `group_activity`.
- A row with `group_id = null` is personal (only its owner can see it). A row with a `group_id` is shared with that group's members.
- In a group, each member's rating of a dish is a row in `dish_ratings` (one per person per dish). The frontend averages them.
- `group_activity` is written **only** by the triggers `log_dish_added`, `log_rating_added` and `log_comment_added`.

### RPCs (security definer)
`create_group`, `join_group`, `regenerate_invite`, `transfer_ownership`, `ensure_profile`.

### API routes
- `GET /api/auth-lookup?username=` converts a username to an email before login. `?available=` checks whether a username is free. Uses `DATABASE_URL`.
- `GET /api/maps-resolve?url=<maps.app.goo.gl link>` returns `{ url }`, the full Google Maps link a short link leads to. The app reads lat/lng from it. It starts only from Google short links, follows at most 5 redirects, and only to Google hosts (otherwise 400). No key or env. Tests: `api/maps-resolve.test.js`.
- (Old, only on the unmerged `BiteMark/Maps_feature`: `/api/geocode` with OpenCage/Nominatim. Not used.)

### Env vars
- Server only: `DATABASE_URL` and `OPENCAGE_API_KEY`. These must never have a `VITE_` prefix.
- Scripts: `NEON_DB_URL` and `SUPABASE_DB_URL` (migration only).

## Decision log
- **(existing)** Migrated from Supabase to Neon. The client file is still `src/supabase.js` so the call sites didn't need to change. Users were matched by email during migration (`scripts/migrate-from-supabase.mjs`).
- **(existing)** Username→email lookup runs in a server function, because it must work before login, when RLS would block it.
- **(existing, Maps branch)** Geocoding runs server-side. This avoids CORS problems and keeps the key out of the browser. Order is OpenCage, then Nominatim, then the city-centre fallback. Geocoding is best-effort and never blocks a save.

- **2026-10-25 — Bill scan needs no backend work.**
  - OCR runs on the device (Tesseract.js). There is no new API route, no API key and no cost per scan.
  - The bill photo is never uploaded or stored.
  - Scanned dishes are saved through the existing `places`/`dishes` inserts. The schema is unchanged.
  - The "comment required" rule is enforced only in the UI. `dishes.note` is still nullable in the database.

## Open items / known gaps
- ⚠️ **`lat` / `lng` columns are missing from `db/neon-schema.sql`.** The Maps code writes `places.lat/lng` and `wishlist.lat/lng`. Need to confirm whether they were added by hand in Neon. Either way, the migration belongs in the schema file.
- `scripts/geocode-backfill.mjs` exists (use `--dry` or `--force`). Not yet confirmed whether it has been run.

## Branches
- Note: `api/geocode.js`, `scripts/geocode-backfill.mjs` and the lat/lng work exist only on `BiteMark/Maps_feature`. That branch is not to be merged.
- `BiteMark/Bill_Scan` (from `origin/main`): bill scanning (in progress).

## Session log
- 2026-10-25: Onboarding session. Read the codebase and started these docs. No code changes yet.
- 2026-10-25: Bill scan (`BiteMark/Bill_Scan`) shipped with no backend changes. Playwright wrote one test place to the live Neon DB and deleted it through the UI.
  - There is no separate test or staging database. Any end-to-end save test writes to production, so always clean up afterwards.
- 2026-10-26: Capture a bill (`BiteMark/Bill_Capture`) needed no backend changes. The photo stays on the device.
- 2026-10-26: **Bill photos table** (`BiteMark/Bill_Photo`). Migration file: `db/migrations/2026-10-26-bill-photos.sql`. It is also appended to `db/neon-schema.sql` as section 8.
  - **Table:** `bill_photos(id, place_id → places ON DELETE CASCADE, user_id default auth.uid(), image text, created_at)`.
    - `image` holds a JPEG data URL (about 150 KB). A CHECK requires the `data:image/jpeg;base64,` prefix and length ≤ 1,500,000.
    - Index on `(place_id, created_at desc)`.
  - **Rules (user decision: group bills are visible to all members):**
    - Read: anyone who can see the place, using the places RLS through `exists`.
    - Insert: the row must be your own and the place visible to you.
    - Delete: the person who added it, or the group owner (`is_group_owner`).
    - `authenticated` is granted select, insert and delete.
  - **Storage (user decision: store in Neon).** The database was 9 MB with 61 places and 204 dishes on 2026-10-26. At about 150 KB per bill, the ~0.5 GB free tier holds roughly 3,000 bills. Vercel Blob was rejected because its links are public by default and it needs more setup. Phone-only storage was rejected because bills wouldn't sync.
  - **⚠️ Deploy order:** run the migration BEFORE deploying the frontend. `Journal.jsx` now selects `bill_photos(id)`, and the journal fails to load if the table doesn't exist.
  - **Status:** APPLIED on 2026-10-26. The user ran the whole `neon-schema.sql` in the SQL Editor and refreshed the Data API schema cache. Claude's own attempt had been blocked by the Claude Code permission check.
  - **Update:** the user ran the whole `neon-schema.sql` in the SQL Editor, which is re-runnable. Verified read-only: data untouched (61 places, 204 dishes, 5 ratings, 1 wishlist item, 2 groups), `bill_photos` has RLS on and its 3 policies.
    - Running the whole file also gave `authenticated` UPDATE on the table. That is harmless because no update policy exists.
  - **Gotcha: the Neon Data API caches the schema.** Right after the migration the app got "Could not find a relationship between 'places' and 'bill_photos' in the schema cache". After any new table or foreign key, refresh it: Neon Console → Data API → Refresh schema cache, or run `NOTIFY pgrst, 'reload schema';`.

### 2026-10-28: `maps_url` on places and wishlist (branch `BiteMark/Maps_Links`)
- **Migration:** `db/migrations/2026-10-28-maps-url.sql`, also added to `db/neon-schema.sql` as section 9. It adds a nullable `maps_url text` to `places` and `wishlist`.
  - A check constraint allows only https Google Maps links (`maps.app.goo.gl/`, `goo.gl/maps`, `maps.google.*/`, `google.*/maps`) of at most 500 characters, so nothing else can be stored through the Data API.
  - The existing grants and RLS policies cover the column; no policy changes.
  - It ends with `notify pgrst, 'reload schema'`.
- **STATUS: not yet applied. The user runs it** in Neon Console → SQL Editor, then refreshes the Data API schema cache if the NOTIFY doesn't take.
  - Until then the app saves places without the link (`src/mapsSave.js` retries without `maps_url` on "column not found") and opens Maps by name + area + city instead.

### 2026-10-29: Demo account reset (branch `BiteMark/Demo_Account`)
- **`db/migrations/2026-10-29-demo-account.sql`** (generated by `node db/demo/build-demo-sql.mjs` from `db/demo/demo-seed.mjs`; don't edit it by hand) creates `reset_demo()`, a SECURITY DEFINER function executable by `authenticated`.
  - **Guard:** it refuses unless `auth.uid()` is a Neon Auth user whose email is one of the demo emails (`demo.user@example.com`, `demo@example.com`; kept in sync with `DEMO_EMAILS` in `src/demoAccount.js`). The profile's display name is reset to the account's own name.
  - **Gotcha (2026-10-28):** after the user first ran the SQL, the app got PGRST202 "Could not find the function public.reset_demo … in the schema cache". So run the whole file, check `select proname from pg_proc where proname = 'reset_demo'`, and use Data API → Refresh schema cache if needed. The app now logs a failed reset to the console.
  - **Wipe:** it deletes everything that user owns or added: owned groups (cascading their places, wishes and activity), memberships, comments, reactions, ratings, places (cascading dishes and bills), dishes, and wishlist. It also resets the profile's display_name to 'Test'.
  - **Re-insert:** the sample journal (seed embedded as jsonb), the personal Want to try list, and the "Weekend Foodies" group with places, dishes, dish_ratings, reactions, comments and group wishes.
- **STATUS: not applied yet. The user runs it** in Neon SQL Editor. It ends with `notify pgrst, 'reload schema'`; refresh the Data API schema cache if the app says the function isn't found.
- **Demo users:** both created via app sign-up, passwords public on purpose. Their profile rows exist (ensure_profile ran on the first login).
  - `test` / `test1234` (`demo@example.com`), created 2026-10-29.
  - `Demo` / `demo1234` (`demo.user@example.com`), created 2026-10-28; "Try the demo" uses it.
- **To change the sample data:** edit `demo-seed.mjs`, run `node db/demo/build-demo-sql.mjs`, and re-run the generated SQL.

### 2026-10-28: Exact locations (branch `BiteMark/Near_Me`)
- **Migration `db/migrations/2026-10-30-place-location.sql`:**
  - Adds `lat`, `lng` (double precision) and `loc_source` (gps | link | pin) to `places` and `wishlist`.
  - Check (after the review): **only rows with a `loc_source`** must have valid lat/lng (`loc_source is null or (source ok and lat/lng set and in range)`). Old rows from the experiment are never checked, so editing them can't fail, and nothing is deleted. (NOT VALID alone wouldn't do this: Postgres re-checks any updated row.)
  - Ends with `notify pgrst, 'reload schema'`.
  - **STATUS: applied by the user (confirmed 2026-10-28: `places.loc_source` answers).**
- **Finding (2026-10-28):** the live database **already had `lat` / `lng`** on places and wishlist (from the old `BiteMark/Maps_feature` experiment, whose backfill may have stored automatic guesses), but no `loc_source`.
  - Decision: keep that data. The app counts a position as exact only when `loc_source` is set, so old guesses never appear in Near me.
  - Fix locations offers each old guess as the starting pin for the user to confirm.
  - Before this migration runs, saves with a location retry without lat/lng/loc_source and say so.
- **Demo:** `reset_demo()` now inserts lat / lng / `loc_source='pin'` for all 85 demo entries (72 places, 6 wishes, 5 group places, 2 group wishes).
  - **Run order: location migration first, then `2026-10-29-demo-account.sql`.** That SQL also allows both demo emails; the copy in the database only allowed `test`, which is why "Try the demo" (the Demo account) got "reset_demo is only for the demo accounts".
  - Positions come from `db/demo/demo-coords.json`, looked up once in OpenStreetMap Nominatim at 1 request per second. 14 are exact name matches in the right area. The other 65 are area centres flagged `approx`; wrong branches and wrong buildings were rejected by hand: both Sankalps, Chatkazz, Gwalia, Honest, Barbeque Nation, Starbucks, Upper Crust, Havmor and Hocco.
  - Approximate demo pins get a fixed 80-280 m nudge from the name, so places in the same area don't stack.
- **Free services:** OpenStreetMap tiles (tile usage policy: low traffic, attribution shown), Photon (fair use; only on user action), and Nominatim (used once, offline, for the demo seed). No keys, no billing.

### 2026-10-29: `loc_source = 'area'`
- `2026-10-30-place-location.sql` now allows `'area'` (automatic, area-level positions from the landmark and city via OpenStreetMap; see frontend.md). **Re-run it** (it only replaces the rule), then re-run `2026-10-29-demo-account.sql` (68 demo entries are now `'area'`).
- The app updates `places` / `wishlist` lat, lng and loc_source from the browser with the filter `loc_source is null or loc_source = 'area'`, so exact spots are never overwritten. RLS decides who may update (owner, or group owner).
