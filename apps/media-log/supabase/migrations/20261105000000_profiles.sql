-- Stage 1: the profiles table (one row per account).
-- How to use: Supabase dashboard > SQL Editor > New query > paste this whole file > Run.
-- Stage 2 adds the other tables (media_items, logs, lists, ...) in new files.

create table if not exists public.profiles (
  -- Same id as the login account in Supabase's own auth.users table.
  -- "on delete cascade": if the account is deleted, its profile goes too.
  id uuid primary key references auth.users (id) on delete cascade,

  -- Lowercase, starts with a letter, 3 to 20 letters/digits/underscores.
  -- KEEP IN SYNC with USERNAME_PATTERN in lib/auth/validation.ts.
  -- "unique" means two people can never have the same username.
  username text not null unique
    check (username ~ '^[a-z][a-z0-9_]{2,19}$'),

  display_name text check (char_length(display_name) <= 50),
  avatar_url text,
  bio text check (char_length(bio) <= 300),
  created_at timestamptz not null default now()
);

-- Row Level Security (RLS): with it ON, nobody can read or write a row unless a
-- policy below says so. The browser uses the public "anon" key, so these
-- policies are the real lock on the data, not the JavaScript code.
alter table public.profiles enable row level security;

-- Profiles are public pages (/u/username), so anyone may read them.
drop policy if exists "Profiles are readable by everyone" on public.profiles;
create policy "Profiles are readable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

-- A signed-in user may create exactly their own profile: the row id must equal
-- their account id. auth.uid() is "the id of whoever sent this request".
drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- A signed-in user may edit only their own profile (used in later stages).
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No delete policy: profiles are removed only when the account is deleted (cascade).

-- Table permissions for the two roles the browser can use. RLS above then
-- filters which rows each request may touch.
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
