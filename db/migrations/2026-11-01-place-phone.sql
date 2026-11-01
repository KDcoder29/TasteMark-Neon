-- A contact number for places and "Want to try" (optional: empty = no number). Safe to run more than once.
-- Run in: Neon Console -> SQL Editor. Then Data API -> Refresh schema cache (or the NOTIFY below).
--
-- Only phone-number text fits (the app checks the same, lib/phone.js isPhone): digits with + ( ) -
-- and spaces, 8 to 15 digits, at most 30 characters. Existing grants and row-level policies already
-- cover the new column.

alter table places   add column if not exists phone text;
alter table wishlist add column if not exists phone text;

alter table places   drop constraint if exists places_phone_check;
alter table places   add  constraint places_phone_check check (
  phone is null or (length(phone) <= 30 and phone ~ '^\+?[0-9 ()-]+$'
    and length(regexp_replace(phone, '[^0-9]', '', 'g')) between 8 and 15));

alter table wishlist drop constraint if exists wishlist_phone_check;
alter table wishlist add  constraint wishlist_phone_check check (
  phone is null or (length(phone) <= 30 and phone ~ '^\+?[0-9 ()-]+$'
    and length(regexp_replace(phone, '[^0-9]', '', 'g')) between 8 and 15));

notify pgrst, 'reload schema';
