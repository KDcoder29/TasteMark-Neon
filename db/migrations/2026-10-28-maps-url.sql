-- Exact Google Maps links for places and "Want to try" (optional; empty = the app searches Maps
-- for the name, area and city instead). Safe to run more than once.
-- Run in: Neon Console -> SQL Editor. Then Data API -> Refresh schema cache (or the NOTIFY below).
--
-- Only https Google Maps links fit (the app checks the same; this stops anything else being stored
-- through the API). Existing grants and row-level policies already cover the new column.

alter table places   add column if not exists maps_url text;
alter table wishlist add column if not exists maps_url text;

alter table places   drop constraint if exists places_maps_url_check;
alter table places   add  constraint places_maps_url_check check (
  maps_url is null or (length(maps_url) <= 500 and maps_url ~ '^https://(maps\.app\.goo\.gl/|goo\.gl/maps|maps\.google\.[a-z.]+/|(www\.)?google\.[a-z.]+/maps)'));

alter table wishlist drop constraint if exists wishlist_maps_url_check;
alter table wishlist add  constraint wishlist_maps_url_check check (
  maps_url is null or (length(maps_url) <= 500 and maps_url ~ '^https://(maps\.app\.goo\.gl/|goo\.gl/maps|maps\.google\.[a-z.]+/|(www\.)?google\.[a-z.]+/maps)'));

notify pgrst, 'reload schema';
