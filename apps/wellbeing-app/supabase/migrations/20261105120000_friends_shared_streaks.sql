-- Stage 4: friends and shared streaks. Two tables (friendships,
-- shared_streaks) and one function (shared_streak_days).
-- How to use: Supabase dashboard > SQL Editor > New query > paste this whole
-- file > Run. Run it AFTER the Stage 1 and Stage 2 files. Safe to run twice.
--
-- PRIVACY DESIGN (follows the note in 20261105110000_checkins_habits.sql):
--   * `checkins` (mood, screen time, gratitude, JOURNAL) is NOT touched here.
--     Friends get no access to it, now or ever.
--   * `habit_entries` gets NO new policy either. RLS works on whole rows, and
--     a habit entry row includes the value (e.g. "12 minutes"), which a friend
--     doesn't need.
--   * Instead, ONE function, shared_streak_days(), answers exactly one
--     question: "on which days did each of us complete the habit we share?".
--     It returns (user_id, day) pairs and nothing else. See the long comment
--     above it for why it is "security definer" and why that's safe here.
--   * Friends see your username and display name (profiles were already
--     readable by logged-in users since Stage 1, so you can be found).
-- A test (lib/friends/migration.test.ts) checks these rules stay true.
--
-- WHY NO current_count / best_count / last_both_date COLUMNS (they were in
-- PLAN.md): the counts are computed in the app from both people's days, with
-- the same tested streak rules as personal streaks (lib/friends/shared-streaks.ts).
-- A stored copy could go stale (an old day synced late, an entry removed, a
-- freeze that moves) and each person could only update their own rows anyway.

-- ---------------------------------------------------------------------------
-- friendships: user_a asked user_b. pending until user_b accepts.
-- Declining or unfriending DELETES the row (so you can ask again later).
-- ---------------------------------------------------------------------------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  -- References profiles (not just auth.users): you can only befriend someone
  -- who has picked a username. "on delete cascade": a deleted account's
  -- friendships disappear with it.
  user_a uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (user_a <> user_b) -- no befriending yourself
);

-- ONE friendship per pair, whichever direction: (alice, bob) and (bob, alice)
-- are the same pair. least/greatest put the two ids in a fixed order first.
create unique index if not exists friendships_one_per_pair
  on public.friendships (least(user_a, user_b), greatest(user_a, user_b));

-- "My friendships" is: user_a = me OR user_b = me. One index for each side.
create index if not exists friendships_user_b on public.friendships (user_b);

-- ---------------------------------------------------------------------------
-- shared_streaks: user_a shares their habit habit_a with user_b. pending until
-- user_b accepts by picking one of THEIR habits (habit_b). Then active.
-- ---------------------------------------------------------------------------
create table if not exists public.shared_streaks (
  id uuid primary key default gen_random_uuid(),
  friendship_id uuid not null,
  -- The name of habit_a when it was shared, so the friend can see WHICH habit
  -- without being able to read user_a's habits table (it stays owner-only).
  habit_name text not null check (char_length(btrim(habit_name)) between 1 and 40),
  user_a uuid not null default auth.uid(),
  user_b uuid not null,
  habit_a uuid not null,
  habit_b uuid, -- null while pending
  status text not null default 'pending' check (status in ('pending', 'active')),
  created_at timestamptz not null default now(),
  check (user_a <> user_b),
  check (status = 'pending' or habit_b is not null), -- active needs both habits
  -- The streak belongs to a friendship. "on delete cascade": unfriending
  -- removes its shared streaks too. (That the friendship is between THESE two
  -- people, in either order, is checked by the insert policy below: a foreign
  -- key can't say "either order".)
  foreign key (friendship_id) references public.friendships (id) on delete cascade,
  -- Composite foreign keys, like habit_entries in Stage 2: habit_a must be a
  -- habit OF user_a, habit_b a habit OF user_b. Nobody can attach someone
  -- else's habit, even by tampering with a request. (A null habit_b skips
  -- the check, which is what we want while pending.)
  foreign key (habit_a, user_a) references public.habits (id, user_id) on delete cascade,
  foreign key (habit_b, user_b) references public.habits (id, user_id) on delete cascade,
  -- Sharing the same habit twice with the same friend makes no sense.
  unique (habit_a, user_b)
);

create index if not exists shared_streaks_user_a on public.shared_streaks (user_a);
create index if not exists shared_streaks_user_b on public.shared_streaks (user_b);
create index if not exists shared_streaks_friendship on public.shared_streaks (friendship_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.friendships enable row level security;
alter table public.shared_streaks enable row level security;

-- friendships: the two people in it can see it.
drop policy if exists "People in a friendship can read it" on public.friendships;
create policy "People in a friendship can read it"
  on public.friendships for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

-- You can only ask on your own behalf, and a new request is always pending
-- (nobody can create an already-accepted friendship with you).
drop policy if exists "You can send a friend request" on public.friendships;
create policy "You can send a friend request"
  on public.friendships for insert to authenticated
  with check ((select auth.uid()) = user_a and status = 'pending');

-- Only the person who was ASKED can accept. Together with the column grant at
-- the bottom (only "status" can be updated), nobody can swap the people.
drop policy if exists "The person asked can accept" on public.friendships;
create policy "The person asked can accept"
  on public.friendships for update to authenticated
  using ((select auth.uid()) = user_b and status = 'pending')
  with check ((select auth.uid()) = user_b and status = 'accepted');

-- Either person can delete it: decline, cancel your request, or unfriend.
drop policy if exists "People in a friendship can end it" on public.friendships;
create policy "People in a friendship can end it"
  on public.friendships for delete to authenticated
  using ((select auth.uid()) in (user_a, user_b));

-- shared_streaks: the two people in it can see it. The row holds no private
-- data: names of the habit, two ids, a status.
drop policy if exists "People in a shared streak can read it" on public.shared_streaks;
create policy "People in a shared streak can read it"
  on public.shared_streaks for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

-- You can invite only on your own behalf, only a FRIEND (an accepted
-- friendship between exactly these two people), and only as pending.
-- "shared_streaks.user_a" is written in full because inside the subquery a
-- bare "user_a" would mean the friendship's column.
drop policy if exists "You can invite a friend to a shared streak" on public.shared_streaks;
create policy "You can invite a friend to a shared streak"
  on public.shared_streaks for insert to authenticated
  with check (
    (select auth.uid()) = user_a
    and status = 'pending'
    and habit_b is null
    and exists (
      select 1 from public.friendships f
      where f.id = shared_streaks.friendship_id
        and f.status = 'accepted'
        and ((f.user_a = shared_streaks.user_a and f.user_b = shared_streaks.user_b)
          or (f.user_a = shared_streaks.user_b and f.user_b = shared_streaks.user_a))
    )
  );

-- Only the invited person can accept, by setting THEIR habit (the composite
-- foreign key checks it's theirs) and status = active. Column grant below:
-- only habit_b and status can change.
drop policy if exists "The invited friend can accept" on public.shared_streaks;
create policy "The invited friend can accept"
  on public.shared_streaks for update to authenticated
  using ((select auth.uid()) = user_b and status = 'pending')
  with check ((select auth.uid()) = user_b and status = 'active' and habit_b is not null);

-- Either person can delete it: decline, cancel, or stop the shared streak.
drop policy if exists "People in a shared streak can end it" on public.shared_streaks;
create policy "People in a shared streak can end it"
  on public.shared_streaks for delete to authenticated
  using ((select auth.uid()) in (user_a, user_b));

-- ---------------------------------------------------------------------------
-- shared_streak_days: the ONLY window friends get into habit data.
--
-- The problem: your friend's app must know "did Sam complete Stretch on
-- Nov 5?", but Sam's habit_entries are owner-only (RLS), and we don't want to
-- open whole rows (with the value) to friends.
--
-- The solution: a function that runs with the rights of its OWNER (that's
-- what "security definer" means, like a program running as administrator)
-- instead of the person calling it. So it CAN read habit_entries past RLS,
-- and it's safe because the function decides exactly what comes out:
--   1. it only answers if YOU are one of the two people in the shared
--      streak, the streak is active, and you're still friends;
--   2. it only looks at the two habits in that streak;
--   3. it only returns (user_id, day) for days the habit was DONE. "Done"
--      uses the owner's own goal (value >= target), worked out inside, so
--      neither the value nor the goal ever leaves the database;
--   4. it never touches the checkins table (no journal, mood, gratitude).
-- "set search_path = ''" is a standard safety rule for security definer
-- functions: every table is written with its schema (public.habits), so
-- nobody can trick it into using a look-alike table they created.
-- "stable": it only reads, never writes.
--
-- The "done" rule matches isHabitDone() in lib/streaks.ts: yes/no habits
-- (target null) and count habits without a goal are done with any entry
-- (entries are always >= 1); with a goal, when value >= target.
-- ---------------------------------------------------------------------------
create or replace function public.shared_streak_days(p_streak_id uuid, p_from date, p_to date)
returns table (user_id uuid, day date)
language sql
stable
security definer
set search_path = ''
as $$
  select e.user_id, e.date as day
  from public.shared_streaks s
  join public.friendships f
    on f.id = s.friendship_id and f.status = 'accepted'
  join public.habits h
    on (h.id = s.habit_a and h.user_id = s.user_a)
    or (h.id = s.habit_b and h.user_id = s.user_b)
  join public.habit_entries e
    on e.habit_id = h.id and e.user_id = h.user_id
  where s.id = p_streak_id
    and s.status = 'active'
    and (select auth.uid()) in (s.user_a, s.user_b)
    and e.date between p_from and p_to
    and e.value >= coalesce(h.target, 1)
  -- A fixed order, so the app can fetch long histories in pages (fetchAllPages).
  order by e.date, e.user_id;
$$;

-- Functions can be called by everyone by default. Only logged-in users may
-- call this one (and the checks inside still limit what they get).
revoke execute on function public.shared_streak_days(uuid, date, date) from public, anon;
grant execute on function public.shared_streak_days(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Table permissions. Supabase gives new tables broad default permissions, so
-- we first take everything away, then give back only what the app uses.
-- "update (status)" is a COLUMN grant: only that column may be changed.
-- ---------------------------------------------------------------------------
revoke all on public.friendships, public.shared_streaks from anon, authenticated;
grant select, insert, delete on public.friendships to authenticated;
grant update (status) on public.friendships to authenticated;
grant select, insert, delete on public.shared_streaks to authenticated;
grant update (status, habit_b) on public.shared_streaks to authenticated;
