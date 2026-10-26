-- Bill photos: the bill you scanned when adding a place, kept so you can look at it later.
-- Safe to run more than once. Run in: Neon Console -> SQL Editor (or the migration helper).
--
-- Who sees what (same as places):
--   personal place -> only you.   group place -> every member of that group.
--   delete: whoever added the bill, or the group's owner. Deleting a place deletes its bills.

create table if not exists bill_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places on delete cascade,
  user_id uuid not null default auth.uid() references neon_auth."user" (id) on delete cascade,
  -- a compressed JPEG as a data URL (~150 KB). Capped at ~1.1 MB so one bad upload can't eat the quota.
  image text not null check (image like 'data:image/jpeg;base64,%' and length(image) <= 1500000),
  created_at timestamptz default now()
);
create index if not exists bill_photos_place_idx on bill_photos (place_id, created_at desc);
alter table bill_photos enable row level security;

grant select, insert, delete on bill_photos to authenticated;

-- "a place you can see" = the places rules decide (personal: yours; group: you are a member)
drop policy if exists "bills read" on bill_photos;
create policy "bills read" on bill_photos for select to authenticated
  using (exists (select 1 from places p where p.id = bill_photos.place_id));

drop policy if exists "bills add" on bill_photos;
create policy "bills add" on bill_photos for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from places p where p.id = bill_photos.place_id));

drop policy if exists "bills remove" on bill_photos;
create policy "bills remove" on bill_photos for delete to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from places p where p.id = bill_photos.place_id
      and p.group_id is not null and is_group_owner(p.group_id)));
