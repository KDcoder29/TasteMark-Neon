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
- `GET /api/geocode?area=&city=&q=` returns `{lat,lng}` or nulls. It tries OpenCage first (if `OPENCAGE_API_KEY` is set), then Nominatim. Results are limited to India (`countrycode=in`). It falls back through area+city, then "area city", then city alone. It never fails a save.

### Env vars
- Server only: `DATABASE_URL` and `OPENCAGE_API_KEY`. These must never have a `VITE_` prefix.
- Scripts: `NEON_DB_URL` and `SUPABASE_DB_URL` (migration only).

## Decision log
- **(existing)** Migrated from Supabase to Neon. The client file is still `src/supabase.js` so the call sites didn't need to change. Users were matched by email during migration (`scripts/migrate-from-supabase.mjs`).
- **(existing)** Username→email lookup runs in a server function, because it must work before login, when RLS would block it.
- **(existing, Maps branch)** Geocoding runs server-side. This avoids CORS problems and keeps the key out of the browser. Order is OpenCage, then Nominatim, then the city-centre fallback. Geocoding is best-effort and never blocks a save.

## Open items / known gaps
- ⚠️ **`lat` / `lng` columns are missing from `db/neon-schema.sql`.** The Maps code writes `places.lat/lng` and `wishlist.lat/lng`. Need to confirm whether they were added by hand in Neon. Either way, the migration belongs in the schema file.
- `scripts/geocode-backfill.mjs` exists (use `--dry` or `--force`). Not yet confirmed whether it has been run.

## Session log
- 2026-10-25: Onboarding session. Read the codebase and started these docs. No code changes yet.
