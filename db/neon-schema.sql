-- Tastemark on Neon: complete schema (run ONCE on a fresh Neon database)
--
-- Before running: Neon Console -> your project -> Data API -> Enable (with "Use Neon Auth" ticked).
-- That creates the neon_auth.user table and the auth.uid() function used below.
-- Run in: Neon Console -> SQL Editor (paste everything, Run).

-- 0. SAFETY CHECKS -----------------------------------------------------------------
do $$ begin
  if to_regclass('neon_auth."user"') is null then
    raise exception 'neon_auth."user" not found. Enable Neon Auth (Data API -> Use Neon Auth) first.';
  end if;
  if to_regprocedure('auth.uid()') is null then
    raise exception 'auth.uid() not found. Enable the Data API first.';
  end if;
end $$;

-- 1. CORE TABLES ---------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references neon_auth."user" (id) on delete cascade,
  display_name text,
  username text
);
do $$ begin
  alter table profiles add constraint profiles_username_format
    check (username is null or username ~ '^[A-Za-z0-9_.]{3,20}$');
exception when duplicate_object then null; end $$;
create unique index if not exists profiles_username_key on profiles (lower(username));
alter table profiles enable row level security;

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  invite_code text not null unique
    default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  owner_id uuid not null default auth.uid() references neon_auth."user" (id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists group_members (
  group_id uuid not null references groups on delete cascade,
  user_id uuid not null references neon_auth."user" (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references neon_auth."user" (id) on delete cascade,
  group_id uuid references groups on delete cascade,
  name text not null,
  city text,
  area text,
  categories text[] default '{}',
  directions text,
  created_at timestamptz default now()
);
create index if not exists places_group_idx on places (group_id);
create index if not exists places_user_idx on places (user_id);

create table if not exists dishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references neon_auth."user" (id) on delete cascade,
  place_id uuid not null references places on delete cascade,
  name text not null,
  price int,
  rating int check (rating between 1 and 5),
  order_again text,
  note text,
  created_at timestamptz default now()
);
create index if not exists dishes_place_idx on dishes (place_id);

alter table groups enable row level security;
alter table group_members enable row level security;
alter table places enable row level security;
alter table dishes enable row level security;

-- 3. HELPER FUNCTIONS (used by the security rules) ---------------------------
create or replace function is_group_member(gid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from group_members where group_id = gid and user_id = auth.uid())
$$;

create or replace function is_group_owner(gid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from group_members
                 where group_id = gid and user_id = auth.uid() and role = 'owner')
$$;

create or replace function shares_group_with(uid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from group_members a
                 join group_members b on a.group_id = b.group_id
                 where a.user_id = auth.uid() and b.user_id = uid)
$$;

-- 4. CREATE / JOIN (run on the server so nobody can add themselves to a group) -
create or replace function create_group(gname text) returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if char_length(trim(coalesce(gname, ''))) = 0 then raise exception 'Group name is required'; end if;
  insert into groups (name, owner_id) values (trim(gname), auth.uid()) returning id into gid;
  insert into group_members (group_id, user_id, role) values (gid, auth.uid(), 'owner');
  return gid;
end $$;

create or replace function join_group(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into gid from groups
   where invite_code = upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  if gid is null then raise exception 'Invalid invite code'; end if;
  insert into group_members (group_id, user_id) values (gid, auth.uid())
  on conflict do nothing;
  return gid;
end $$;

revoke all on function create_group(text), join_group(text) from public;
grant execute on function create_group(text), join_group(text) to authenticated;

-- 5. SECURITY RULES ----------------------------------------------------------
-- profiles: you see yourself and people who share a group with you
drop policy if exists "profiles read" on profiles;
create policy "profiles read" on profiles for select to authenticated
  using (id = auth.uid() or shares_group_with(id));
drop policy if exists "profiles insert own" on profiles;
create policy "profiles insert own" on profiles for insert to authenticated
  with check (id = auth.uid());
drop policy if exists "profiles update own" on profiles;
create policy "profiles update own" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- groups: members can see them, only the owner can delete
drop policy if exists "groups read" on groups;
create policy "groups read" on groups for select to authenticated
  using (is_group_member(id));
drop policy if exists "groups delete" on groups;
create policy "groups delete" on groups for delete to authenticated
  using (owner_id = auth.uid());

-- members: see your group's members; leave yourself, or the owner removes someone
drop policy if exists "members read" on group_members;
create policy "members read" on group_members for select to authenticated
  using (is_group_member(group_id));
drop policy if exists "members leave or remove" on group_members;
create policy "members leave or remove" on group_members for delete to authenticated
  using (role <> 'owner' and (user_id = auth.uid() or is_group_owner(group_id)));

-- places: personal = only you. group = only its members.
drop policy if exists "places read" on places;
create policy "places read" on places for select to authenticated
  using ((group_id is null and user_id = auth.uid())
      or (group_id is not null and is_group_member(group_id)));

drop policy if exists "places insert" on places;
create policy "places insert" on places for insert to authenticated
  with check (user_id = auth.uid() and (group_id is null or is_group_member(group_id)));

drop policy if exists "places update" on places;
create policy "places update" on places for update to authenticated
  using (user_id = auth.uid() or (group_id is not null and is_group_owner(group_id)))
  with check ((group_id is null and user_id = auth.uid())
           or (group_id is not null and is_group_member(group_id)));

drop policy if exists "places delete" on places;
create policy "places delete" on places for delete to authenticated
  using (user_id = auth.uid() or (group_id is not null and is_group_owner(group_id)));

-- dishes: you can see dishes of any place you can see,
-- and change dishes only on places you may edit (your own, or any if you own the group)
drop policy if exists "dishes read" on dishes;
create policy "dishes read" on dishes for select to authenticated
  using (exists (select 1 from places p where p.id = dishes.place_id));

drop policy if exists "dishes insert" on dishes;
create policy "dishes insert" on dishes for insert to authenticated
  with check (exists (select 1 from places p where p.id = dishes.place_id
    and (p.user_id = auth.uid() or (p.group_id is not null and is_group_owner(p.group_id)))));

drop policy if exists "dishes update" on dishes;
create policy "dishes update" on dishes for update to authenticated
  using (exists (select 1 from places p where p.id = dishes.place_id
    and (p.user_id = auth.uid() or (p.group_id is not null and is_group_owner(p.group_id)))))
  with check (exists (select 1 from places p where p.id = dishes.place_id
    and (p.user_id = auth.uid() or (p.group_id is not null and is_group_owner(p.group_id)))));

drop policy if exists "dishes delete" on dishes;
create policy "dishes delete" on dishes for delete to authenticated
  using (exists (select 1 from places p where p.id = dishes.place_id
    and (p.user_id = auth.uid() or (p.group_id is not null and is_group_owner(p.group_id)))));

-- 0. HELPER ------------------------------------------------------------------
create or replace function dish_group_id(did uuid) returns uuid
language sql security definer stable set search_path = public as $$
  select p.group_id from dishes d join places p on p.id = d.place_id where d.id = did
$$;

-- 1. TABLES ------------------------------------------------------------------
-- one rating per person per dish (group dishes)
create table if not exists dish_ratings (
  dish_id uuid not null references dishes on delete cascade,
  user_id uuid not null default auth.uid() references neon_auth."user" (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  order_again text check (order_again in ('yes', 'maybe', 'no')),
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (dish_id, user_id)
);

create table if not exists dish_reactions (
  dish_id uuid not null references dishes on delete cascade,
  user_id uuid not null default auth.uid() references neon_auth."user" (id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 8),
  created_at timestamptz default now(),
  primary key (dish_id, user_id, emoji)
);

create table if not exists dish_comments (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references dishes on delete cascade,
  user_id uuid not null default auth.uid() references neon_auth."user" (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz default now()
);
create index if not exists dish_comments_dish_idx on dish_comments (dish_id);

-- "want to try" list. group_id empty = personal wishlist
create table if not exists wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references neon_auth."user" (id) on delete cascade,
  group_id uuid references groups on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  city text,
  area text,
  categories text[] default '{}',
  note text,
  went_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists wishlist_group_idx on wishlist (group_id);

create table if not exists group_activity (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups on delete cascade,
  user_id uuid references neon_auth."user" (id) on delete set null,
  kind text not null,
  place_name text,
  dish_name text,
  detail text,
  created_at timestamptz default now()
);
create index if not exists group_activity_idx on group_activity (group_id, created_at desc);

alter table dish_ratings enable row level security;
alter table dish_reactions enable row level security;
alter table dish_comments enable row level security;
alter table wishlist enable row level security;
alter table group_activity enable row level security;

-- 3. SECURITY RULES ----------------------------------------------------------
-- dishes: any member can add a dish to a group place;
-- a dish can be changed or removed by whoever added it, or by the group owner
drop policy if exists "dishes insert" on dishes;
drop policy if exists "dishes update" on dishes;
drop policy if exists "dishes delete" on dishes;

create policy "dishes insert" on dishes for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from places p where p.id = dishes.place_id
      and ((p.group_id is null and p.user_id = auth.uid())
        or (p.group_id is not null and is_group_member(p.group_id)))));

create policy "dishes update" on dishes for update to authenticated
  using (user_id = auth.uid() or is_group_owner(dish_group_id(id)))
  with check (user_id = auth.uid() or is_group_owner(dish_group_id(id)));

create policy "dishes delete" on dishes for delete to authenticated
  using (user_id = auth.uid() or is_group_owner(dish_group_id(id)));

-- ratings: everyone in the group sees them, you change only your own
drop policy if exists "ratings read" on dish_ratings;
drop policy if exists "ratings insert" on dish_ratings;
drop policy if exists "ratings update" on dish_ratings;
drop policy if exists "ratings delete" on dish_ratings;
create policy "ratings read" on dish_ratings for select to authenticated
  using (is_group_member(dish_group_id(dish_id)));
create policy "ratings insert" on dish_ratings for insert to authenticated
  with check (user_id = auth.uid() and is_group_member(dish_group_id(dish_id)));
create policy "ratings update" on dish_ratings for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_group_member(dish_group_id(dish_id)));
create policy "ratings delete" on dish_ratings for delete to authenticated
  using (user_id = auth.uid());

-- reactions
drop policy if exists "reactions read" on dish_reactions;
drop policy if exists "reactions add" on dish_reactions;
drop policy if exists "reactions remove" on dish_reactions;
create policy "reactions read" on dish_reactions for select to authenticated
  using (is_group_member(dish_group_id(dish_id)));
create policy "reactions add" on dish_reactions for insert to authenticated
  with check (user_id = auth.uid() and is_group_member(dish_group_id(dish_id)));
create policy "reactions remove" on dish_reactions for delete to authenticated
  using (user_id = auth.uid());

-- comments: delete your own; the group owner can delete any
drop policy if exists "comments read" on dish_comments;
drop policy if exists "comments add" on dish_comments;
drop policy if exists "comments remove" on dish_comments;
create policy "comments read" on dish_comments for select to authenticated
  using (is_group_member(dish_group_id(dish_id)));
create policy "comments add" on dish_comments for insert to authenticated
  with check (user_id = auth.uid() and is_group_member(dish_group_id(dish_id)));
create policy "comments remove" on dish_comments for delete to authenticated
  using (user_id = auth.uid() or is_group_owner(dish_group_id(dish_id)));

-- wishlist: personal = only you. group = every member can see, add and mark visited;
-- only the person who added an item (or the owner) can delete it
drop policy if exists "wishlist read" on wishlist;
drop policy if exists "wishlist add" on wishlist;
drop policy if exists "wishlist update" on wishlist;
drop policy if exists "wishlist remove" on wishlist;
create policy "wishlist read" on wishlist for select to authenticated
  using ((group_id is null and user_id = auth.uid())
      or (group_id is not null and is_group_member(group_id)));
create policy "wishlist add" on wishlist for insert to authenticated
  with check (user_id = auth.uid() and (group_id is null or is_group_member(group_id)));
create policy "wishlist update" on wishlist for update to authenticated
  using ((group_id is null and user_id = auth.uid())
      or (group_id is not null and is_group_member(group_id)))
  with check ((group_id is null and user_id = auth.uid())
           or (group_id is not null and is_group_member(group_id)));
create policy "wishlist remove" on wishlist for delete to authenticated
  using (user_id = auth.uid() or (group_id is not null and is_group_owner(group_id)));

-- activity feed: members can read. Only the triggers below can write.
drop policy if exists "activity read" on group_activity;
create policy "activity read" on group_activity for select to authenticated
  using (is_group_member(group_id));

-- 4. ACTIVITY TRIGGERS -------------------------------------------------------
create or replace function log_dish_added() returns trigger
language plpgsql security definer set search_path = public as $$
declare gid uuid; pname text;
begin
  select group_id, name into gid, pname from places where id = new.place_id;
  if gid is not null then
    insert into group_activity (group_id, user_id, kind, place_name, dish_name)
    values (gid, new.user_id, 'dish_added', pname, new.name);
  end if;
  return new;
end $$;
drop trigger if exists trg_dish_added on dishes;
create trigger trg_dish_added after insert on dishes
  for each row execute function log_dish_added();

create or replace function log_rating_added() returns trigger
language plpgsql security definer set search_path = public as $$
declare gid uuid; pname text; dname text;
begin
  select p.group_id, p.name, d.name into gid, pname, dname
    from dishes d join places p on p.id = d.place_id where d.id = new.dish_id;
  if gid is null then return new; end if;
  -- skip when the same person just added this dish (the feed would repeat itself)
  if exists (select 1 from group_activity
             where group_id = gid and kind = 'dish_added' and user_id = new.user_id
               and dish_name = dname and place_name = pname
               and created_at > now() - interval '15 seconds') then
    return new;
  end if;
  insert into group_activity (group_id, user_id, kind, place_name, dish_name, detail)
  values (gid, new.user_id, 'rated', pname, dname, new.rating::text);
  return new;
end $$;
drop trigger if exists trg_rating_added on dish_ratings;
create trigger trg_rating_added after insert on dish_ratings
  for each row execute function log_rating_added();

create or replace function log_comment_added() returns trigger
language plpgsql security definer set search_path = public as $$
declare gid uuid; pname text; dname text;
begin
  select p.group_id, p.name, d.name into gid, pname, dname
    from dishes d join places p on p.id = d.place_id where d.id = new.dish_id;
  if gid is not null then
    insert into group_activity (group_id, user_id, kind, place_name, dish_name, detail)
    values (gid, new.user_id, 'commented', pname, dname, left(new.body, 80));
  end if;
  return new;
end $$;
drop trigger if exists trg_comment_added on dish_comments;
create trigger trg_comment_added after insert on dish_comments
  for each row execute function log_comment_added();

create or replace function log_member_added() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into group_activity (group_id, user_id, kind)
  values (new.group_id, new.user_id, case when new.role = 'owner' then 'created' else 'joined' end);
  return new;
end $$;
drop trigger if exists trg_member_added on group_members;
create trigger trg_member_added after insert on group_members
  for each row execute function log_member_added();

create or replace function log_wish_added() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.group_id is not null then
    insert into group_activity (group_id, user_id, kind, place_name)
    values (new.group_id, new.user_id, 'wish', new.name);
  end if;
  return new;
end $$;
drop trigger if exists trg_wish_added on wishlist;
create trigger trg_wish_added after insert on wishlist
  for each row execute function log_wish_added();

create or replace function log_wish_went() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.went_at is null and new.went_at is not null and new.group_id is not null then
    insert into group_activity (group_id, user_id, kind, place_name)
    values (new.group_id, auth.uid(), 'went', new.name);
  end if;
  return new;
end $$;
drop trigger if exists trg_wish_went on wishlist;
create trigger trg_wish_went after update on wishlist
  for each row execute function log_wish_went();

-- 5. OWNER TOOLS -------------------------------------------------------------
create or replace function regenerate_invite(gid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not is_group_owner(gid) then raise exception 'Only the group owner can do this'; end if;
  c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  update groups set invite_code = c where id = gid;
  return c;
end $$;

create or replace function transfer_ownership(gid uuid, new_owner uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_group_owner(gid) then raise exception 'Only the group owner can do this'; end if;
  if new_owner = auth.uid() then raise exception 'You are already the owner'; end if;
  if not exists (select 1 from group_members where group_id = gid and user_id = new_owner) then
    raise exception 'That person is not in this group';
  end if;
  update group_members set role = 'member' where group_id = gid and user_id = auth.uid();
  update group_members set role = 'owner' where group_id = gid and user_id = new_owner;
  update groups set owner_id = new_owner where id = gid;
  insert into group_activity (group_id, user_id, kind) values (gid, new_owner, 'owner');
end $$;

revoke all on function regenerate_invite(uuid), transfer_ownership(uuid, uuid) from public;
grant execute on function regenerate_invite(uuid), transfer_ownership(uuid, uuid) to authenticated;

-- 6. LOGIN SUPPORT --------------------------------------------------------------------
-- Called by the app right after every login: creates your profile row the first time.
-- The username you typed at sign-up is stored as the Neon Auth "name".
create or replace function ensure_profile() returns void
language plpgsql security definer set search_path = public, neon_auth as $$
declare uid uuid := auth.uid(); n text; e text; uname text;
begin
  if uid is null then return; end if;
  if exists (select 1 from profiles where id = uid) then return; end if;
  select u.name, u.email into n, e from neon_auth."user" u where u.id = uid;
  uname := case when n ~ '^[A-Za-z0-9_.]{3,20}$'
                 and not exists (select 1 from profiles where lower(username) = lower(n))
                then n end;
  insert into profiles (id, display_name, username)
  values (uid, coalesce(nullif(n, ''), split_part(e, '@', 1)), uname)
  on conflict (id) do nothing;
end $$;

-- 7. PERMISSIONS FOR THE DATA API ---------------------------------------------------------
-- Logged-in users ("authenticated") may use the tables; the policies above decide which rows.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
revoke execute on function create_group(text), join_group(text), regenerate_invite(uuid),
  transfer_ownership(uuid, uuid), ensure_profile() from public;
grant execute on function create_group(text), join_group(text), regenerate_invite(uuid),
  transfer_ownership(uuid, uuid), ensure_profile() to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

-- 8. BILL PHOTOS (added 2026-10-26; same as db/migrations/2026-10-26-bill-photos.sql) ------------
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

-- 9. EXACT MAPS LINKS (added 2026-10-28; same as db/migrations/2026-10-28-maps-url.sql) --------
-- optional; empty = the app searches Google Maps for name + area + city
alter table places   add column if not exists maps_url text;
alter table wishlist add column if not exists maps_url text;
alter table places   drop constraint if exists places_maps_url_check;
alter table places   add  constraint places_maps_url_check check (
  maps_url is null or (length(maps_url) <= 500 and maps_url ~ '^https://(maps\.app\.goo\.gl/|goo\.gl/maps|maps\.google\.[a-z.]+/|(www\.)?google\.[a-z.]+/maps)'));
alter table wishlist drop constraint if exists wishlist_maps_url_check;
alter table wishlist add  constraint wishlist_maps_url_check check (
  maps_url is null or (length(maps_url) <= 500 and maps_url ~ '^https://(maps\.app\.goo\.gl/|goo\.gl/maps|maps\.google\.[a-z.]+/|(www\.)?google\.[a-z.]+/maps)'));
