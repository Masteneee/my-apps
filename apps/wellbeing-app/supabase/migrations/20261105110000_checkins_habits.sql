-- Stage 2: the daily check-in. Three tables: habits, checkins, habit_entries.
-- How to use: Supabase dashboard > SQL Editor > New query > paste this whole
-- file > Run. Run it AFTER 20261105100000_profiles.sql. Safe to run twice.
--
-- PRIVACY DESIGN (read this before Stage 4, friends):
-- Row Level Security works on whole ROWS, not single columns. If we ever
-- added a policy "friends can read my checkins", friends could read every
-- column of those rows, journal_text included. So:
--   * `checkins` (mood, screen time, gratitude, JOURNAL) stays OWNER-ONLY,
--     forever. Never add a friends policy to it.
--   * What friends will need in Stage 4 (did you do habit X on day D, for a
--     shared streak) lives in `habit_entries`, a separate table with no text
--     in it. Stage 4 can open up just that, without touching this table.
-- A test (lib/checkin/migration.test.ts) checks these rules stay true.
--
-- KEEP IN SYNC: the limits below match lib/checkin/validation.ts, so the
-- browser and the database agree on what is allowed.

-- ---------------------------------------------------------------------------
-- habits: the things you track (name, type, optional daily target)
-- ---------------------------------------------------------------------------
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  -- default auth.uid(): if the app forgets to send it, the row is still yours.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  icon text check (char_length(icon) <= 8), -- an optional emoji
  -- checkbox = done / not done; number = a count (glasses of water);
  -- minutes = time spent (reading, meditation)
  type text not null check (type in ('checkbox', 'number', 'minutes')),
  -- Optional goal per day ("8 glasses", "20 minutes"). Checkbox habits have none.
  target integer check (target between 1 and 100000),
  -- Archived habits disappear from the check-in but keep their history
  -- (Stage 3 streaks and calendars still need it). We never delete habits.
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  check (type <> 'checkbox' or target is null),
  check (type <> 'minutes' or target <= 1440),
  -- Needed by the composite foreign key in habit_entries below.
  unique (id, user_id)
);

-- No two ACTIVE habits with the same name (any case) for one person.
-- "where not is_archived": an archived "Read" doesn't block a new "Read".
create unique index if not exists habits_unique_active_name
  on public.habits (user_id, lower(btrim(name)))
  where not is_archived;

-- ---------------------------------------------------------------------------
-- checkins: one row per person per day. OWNER-ONLY (see the note at the top).
-- ---------------------------------------------------------------------------
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The LOCAL day (America/Toronto for me), worked out by the browser
  -- (lib/checkin/date.ts), not the server's UTC day.
  date date not null,
  -- Every answer can be null/empty: every step of the check-in is skippable.
  mood smallint check (mood between 1 and 5),
  mood_tags text[] not null default '{}'
    check (cardinality(mood_tags) <= 5 and char_length(array_to_string(mood_tags, '')) <= 120),
  screen_time_minutes integer check (screen_time_minutes between 0 and 1440),
  -- Up to 3 short lines. Check constraints can't loop over an array, so we
  -- check each of the 3 slots (a missing slot is null, coalesce makes it 0).
  gratitude text[] not null default '{}'
    check (
      cardinality(gratitude) <= 3
      and coalesce(char_length(gratitude[1]), 0) <= 200
      and coalesce(char_length(gratitude[2]), 0) <= 200
      and coalesce(char_length(gratitude[3]), 0) <= 200
    ),
  journal_text text check (char_length(journal_text) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One check-in per person per day. Saving again UPDATES this row (an
  -- "upsert"), which is how the app saves step by step.
  unique (user_id, date)
);

-- ---------------------------------------------------------------------------
-- habit_entries: what you did for one habit on one day. No row = not done.
-- ---------------------------------------------------------------------------
create table if not exists public.habit_entries (
  habit_id uuid not null,
  -- Stored again here (it's also on the habit) so the RLS rules below are a
  -- simple, fast "user_id = me" instead of a lookup in habits.
  user_id uuid not null default auth.uid(),
  date date not null,
  -- checkbox: 1 = done. number / minutes: the amount (0 is never stored).
  value integer not null check (value between 1 and 100000),
  updated_at timestamptz not null default now(),
  primary key (habit_id, date),
  -- Composite foreign key: the pair (habit_id, user_id) must exist in habits.
  -- So you can only log entries for YOUR OWN habits, enforced by the database.
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade
);

-- Loading "all my entries for this day" (the check-in) and later ranges (Stage 3).
create index if not exists habit_entries_user_date on public.habit_entries (user_id, date);

-- ---------------------------------------------------------------------------
-- Row Level Security: owner-only on all three tables.
-- (select auth.uid()) = "the id of whoever sent this request". The "select"
-- around it lets Postgres compute it once per query instead of once per row.
-- ---------------------------------------------------------------------------
alter table public.habits enable row level security;
alter table public.checkins enable row level security;
alter table public.habit_entries enable row level security;

-- habits
drop policy if exists "Owner can read their habits" on public.habits;
create policy "Owner can read their habits"
  on public.habits for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Owner can create habits" on public.habits;
create policy "Owner can create habits"
  on public.habits for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owner can update their habits" on public.habits;
create policy "Owner can update their habits"
  on public.habits for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
-- No delete policy for habits: you archive them (history is kept).

-- checkins: OWNER-ONLY. Do NOT add a friends policy here (journal_text!).
drop policy if exists "Owner can read their checkins" on public.checkins;
create policy "Owner can read their checkins"
  on public.checkins for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Owner can create checkins" on public.checkins;
create policy "Owner can create checkins"
  on public.checkins for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owner can update their checkins" on public.checkins;
create policy "Owner can update their checkins"
  on public.checkins for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owner can delete their checkins" on public.checkins;
create policy "Owner can delete their checkins"
  on public.checkins for delete to authenticated
  using ((select auth.uid()) = user_id);

-- habit_entries (Stage 4 may add a narrow friends rule for shared streaks here)
drop policy if exists "Owner can read their habit entries" on public.habit_entries;
create policy "Owner can read their habit entries"
  on public.habit_entries for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Owner can create habit entries" on public.habit_entries;
create policy "Owner can create habit entries"
  on public.habit_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owner can update their habit entries" on public.habit_entries;
create policy "Owner can update their habit entries"
  on public.habit_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owner can delete their habit entries" on public.habit_entries;
create policy "Owner can delete their habit entries"
  on public.habit_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Table permissions: nothing for logged-out visitors ("anon"). Logged-in users
-- get the actions the app uses; the policies above then limit them to their own rows.
revoke all on public.habits, public.checkins, public.habit_entries from anon;
grant select, insert, update on public.habits to authenticated;
grant select, insert, update, delete on public.checkins to authenticated;
grant select, insert, update, delete on public.habit_entries to authenticated;
