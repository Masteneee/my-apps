-- Stage 1: the profiles table (one row per account).
-- Same pattern as apps/media-log, with one difference: profiles can only be
-- read by people who are logged in (this is a private wellbeing app, not a
-- public site).
-- How to use: Supabase dashboard > SQL Editor > New query > paste this whole file > Run.
-- Stage 2 adds the other tables (habits, checkins, ...) in new files.

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

-- Logged-in users can read profiles (username + display name only), so that in
-- Stage 4 you can find a friend by username. Logged-out visitors see nothing.
-- Personal data (check-ins, journal) will live in OTHER tables with stricter
-- rules: the journal will be readable by its owner only.
drop policy if exists "Profiles are readable by logged-in users" on public.profiles;
create policy "Profiles are readable by logged-in users"
  on public.profiles for select
  to authenticated
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

-- Table permissions. Only the "authenticated" role (logged-in users) gets any;
-- "anon" (logged out) gets none. RLS above then filters which rows each request may touch.
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;
