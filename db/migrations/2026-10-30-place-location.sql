-- Exact positions for places and "Want to try" (Near me). Optional: empty = no position yet.
-- Safe to run more than once. Run in: Neon Console -> SQL Editor. Then Data API -> Refresh schema
-- cache if the app still says "Saved without the exact location".
--
-- lat / lng are WGS84 degrees (what phones and Google Maps use). loc_source says how it was set:
--   gps  = "I'm here" (the phone's GPS)   link = read from a Google Maps link   pin = placed on the map
--   area = worked out automatically from the landmark / area and city (OpenStreetMap; about 1 km;
--          the app shows it with "≈" and sends Directions to Google by name). Added 2026-10-29:
--          run this file again to allow it (it only replaces the rule).
-- Existing grants and row-level policies already cover the new columns.
--
-- NOTE: the live database already has lat / lng on places and wishlist (an earlier, unmerged map
-- experiment, BiteMark/Maps_feature, may have filled them with automatic guesses). This keeps those
-- values: rows without loc_source are treated by the app as unchecked guesses (not shown in Near me;
-- offered in Fix locations with the old spot as the starting pin). So the rule below only checks rows
-- WITH a loc_source (everything the app saves now): old rows, whatever is in them, can never make
-- this script or a later edit of that row fail, and nothing is deleted. Removing a location sets
-- all three to null.

alter table places   add column if not exists lat double precision;
alter table places   add column if not exists lng double precision;
alter table places   add column if not exists loc_source text;
alter table wishlist add column if not exists lat double precision;
alter table wishlist add column if not exists lng double precision;
alter table wishlist add column if not exists loc_source text;

alter table places drop constraint if exists places_location_check;
alter table places add  constraint places_location_check check (
  loc_source is null
  or (loc_source in ('gps', 'link', 'pin', 'area') and lat is not null and lng is not null
      and lat between -90 and 90 and lng between -180 and 180));

alter table wishlist drop constraint if exists wishlist_location_check;
alter table wishlist add  constraint wishlist_location_check check (
  loc_source is null
  or (loc_source in ('gps', 'link', 'pin', 'area') and lat is not null and lng is not null
      and lat between -90 and 90 and lng between -180 and 180));

notify pgrst, 'reload schema';
