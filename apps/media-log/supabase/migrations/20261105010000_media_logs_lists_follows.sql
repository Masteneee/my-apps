-- Stage 2: the rest of the data model from PLAN.md.
--   media_items  a cached copy of a movie/book/game/... (only once someone logs it)
--   logs         "I watched/read/played this", with status, rating and review
--   lists        a user's lists ("Best anime for people who don't watch anime")
--   list_items   which media items are in which list, in which order
--   follows      who follows whom
--
-- How to use: run 20261105000000_profiles.sql FIRST (these tables point to
-- profiles), then: Supabase dashboard > SQL Editor > New query > paste this
-- whole file > Run. Running it twice is safe ("if not exists" / "drop ... if exists").
--
-- Reminder about Row Level Security (RLS): the browser talks to the database
-- with the public "anon" key. Once RLS is enabled on a table, EVERY row is
-- locked until a policy below allows the action. `auth.uid()` is "the id of
-- whoever sent this request" (null when not logged in). We write it as
-- `(select auth.uid())` because Postgres then computes it once per query
-- instead of once per row (Supabase's recommended, faster form).


-- ---------------------------------------------------------------------------
-- media_items
-- ---------------------------------------------------------------------------
create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  type text not null
    check (type in ('movie', 'series', 'anime', 'manga', 'book', 'game')),
  -- Where the data came from, and that source's own id for it.
  -- KEEP IN SYNC with MEDIA_TYPES / MEDIA_SOURCES in lib/media/types.ts.
  source text not null
    check (source in ('tmdb', 'anilist', 'openlibrary', 'igdb')),
  source_id text not null,
  title text not null check (char_length(title) between 1 and 500),
  year int check (year between 1800 and 2200),
  -- Only https links, so nobody can store a "javascript:..." or http address.
  cover_url text check (cover_url is null or cover_url like 'https://%'),
  -- Directors, authors, studios... A Postgres array of text ('{}' = empty).
  creators text[] not null default '{}',
  -- Episodes, chapters or pages. Null when it doesn't apply (movies) or is unknown.
  total_units int check (total_units > 0),
  cached_at timestamptz not null default now(),
  -- One cached copy per real item. PLAN.md says unique on (source, source_id);
  -- we add `type` because TMDB numbers movies and series separately: movie 550
  -- (Fight Club) and series 550 are two different things with the same id.
  unique (source, type, source_id)
);

alter table public.media_items enable row level security;

-- Media items are just public facts about a movie, so anyone may read them.
drop policy if exists "Media items are readable by everyone" on public.media_items;
create policy "Media items are readable by everyone"
  on public.media_items for select
  to anon, authenticated
  using (true);

-- Any logged-in user may add an item (it happens the first time someone logs it).
-- There is no update or delete policy: once cached, users can't change or remove
-- an item that other people's logs may point to.
drop policy if exists "Logged-in users can cache media items" on public.media_items;
create policy "Logged-in users can cache media items"
  on public.media_items for insert
  to authenticated
  with check (true);

grant select on public.media_items to anon, authenticated;
grant insert on public.media_items to authenticated;


-- ---------------------------------------------------------------------------
-- logs
-- ---------------------------------------------------------------------------
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  -- Points to profiles (not auth.users) so later we can fetch "log + who wrote it"
  -- in one request. Deleting an account deletes its profile, which deletes its logs.
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  media_item_id uuid not null
    references public.media_items (id) on delete cascade,
  -- KEEP IN SYNC with LOG_STATUSES in lib/media/types.ts.
  status text not null default 'completed'
    check (status in ('planned', 'in_progress', 'completed', 'dropped', 'paused')),
  -- 0.5 to 5 in half steps (or null = not rated). "rating * 2 is a whole number"
  -- is how we say "a multiple of 0.5". Same rule as validateRating() in TypeScript.
  rating numeric
    check (rating between 0.5 and 5 and rating * 2 = floor(rating * 2)),
  progress int check (progress >= 0),
  review_text text check (char_length(review_text) <= 5000),
  started_at date,
  finished_at date,
  rewatch boolean not null default false,
  created_at timestamptz not null default now(),
  check (started_at is null or finished_at is null or finished_at >= started_at)
);

-- Indexes make common lookups fast, like the index at the back of a book.
-- "All logs of this user, newest first" (the profile page):
create index if not exists logs_user_id_created_at_idx on public.logs (user_id, created_at desc);
-- "All logs of this movie" (the item page and average rating, Stage 4):
create index if not exists logs_media_item_id_idx on public.logs (media_item_id);

alter table public.logs enable row level security;

-- Diaries are public, like on Letterboxd: anyone can see what you logged.
drop policy if exists "Logs are readable by everyone" on public.logs;
create policy "Logs are readable by everyone"
  on public.logs for select
  to anon, authenticated
  using (true);

-- You can only write logs in your own name...
drop policy if exists "Users can create their own logs" on public.logs;
create policy "Users can create their own logs"
  on public.logs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- ...and only edit or delete your own. "using" picks which existing rows you may
-- touch; "with check" checks the row after the change (so you can't hand it to someone else).
drop policy if exists "Users can update their own logs" on public.logs;
create policy "Users can update their own logs"
  on public.logs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own logs" on public.logs;
create policy "Users can delete their own logs"
  on public.logs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.logs to anon, authenticated;
grant insert, update, delete on public.logs to authenticated;


-- ---------------------------------------------------------------------------
-- lists (used from Stage 5)
-- ---------------------------------------------------------------------------
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text check (char_length(description) <= 1000),
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists lists_user_id_idx on public.lists (user_id);

alter table public.lists enable row level security;

-- Public lists are visible to everyone; private ones only to their owner.
drop policy if exists "Public lists, or your own, are readable" on public.lists;
create policy "Public lists, or your own, are readable"
  on public.lists for select
  to anon, authenticated
  using (is_public or (select auth.uid()) = user_id);

drop policy if exists "Users can create their own lists" on public.lists;
create policy "Users can create their own lists"
  on public.lists for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own lists" on public.lists;
create policy "Users can update their own lists"
  on public.lists for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own lists" on public.lists;
create policy "Users can delete their own lists"
  on public.lists for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.lists to anon, authenticated;
grant insert, update, delete on public.lists to authenticated;


-- ---------------------------------------------------------------------------
-- list_items (used from Stage 5)
-- ---------------------------------------------------------------------------
create table if not exists public.list_items (
  list_id uuid not null references public.lists (id) on delete cascade,
  media_item_id uuid not null references public.media_items (id) on delete cascade,
  -- Order in the list (0 = first). Drag-to-reorder in Stage 5 changes this.
  position int not null default 0 check (position >= 0),
  note text check (char_length(note) <= 500),
  -- The same item can only be in a given list once.
  primary key (list_id, media_item_id)
);

create index if not exists list_items_list_id_position_idx on public.list_items (list_id, position);

alter table public.list_items enable row level security;

-- list_items has no user_id, so the policies look at the list it belongs to.
-- "exists (select 1 from lists ...)" means "there is a matching list that...".
drop policy if exists "Items of readable lists are readable" on public.list_items;
create policy "Items of readable lists are readable"
  on public.list_items for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.lists l
      where l.id = list_id
        and (l.is_public or l.user_id = (select auth.uid()))
    )
  );

drop policy if exists "Owners can add items to their lists" on public.list_items;
create policy "Owners can add items to their lists"
  on public.list_items for insert
  to authenticated
  with check (
    exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid()))
  );

drop policy if exists "Owners can update items in their lists" on public.list_items;
create policy "Owners can update items in their lists"
  on public.list_items for update
  to authenticated
  using (
    exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid()))
  );

drop policy if exists "Owners can remove items from their lists" on public.list_items;
create policy "Owners can remove items from their lists"
  on public.list_items for delete
  to authenticated
  using (
    exists (select 1 from public.lists l where l.id = list_id and l.user_id = (select auth.uid()))
  );

grant select on public.list_items to anon, authenticated;
grant insert, update, delete on public.list_items to authenticated;


-- ---------------------------------------------------------------------------
-- follows (used from Stage 5)
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  following_id uuid not null
    references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- You can follow someone only once, and never yourself.
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

-- "Who follows this person?" (the primary key already covers "who do I follow?").
create index if not exists follows_following_id_idx on public.follows (following_id);

alter table public.follows enable row level security;

drop policy if exists "Follows are readable by everyone" on public.follows;
create policy "Follows are readable by everyone"
  on public.follows for select
  to anon, authenticated
  using (true);

-- You can only follow (and unfollow) as yourself. No update: unfollow + follow instead.
drop policy if exists "Users can follow as themselves" on public.follows;
create policy "Users can follow as themselves"
  on public.follows for insert
  to authenticated
  with check ((select auth.uid()) = follower_id);

drop policy if exists "Users can unfollow as themselves" on public.follows;
create policy "Users can unfollow as themselves"
  on public.follows for delete
  to authenticated
  using ((select auth.uid()) = follower_id);

grant select on public.follows to anon, authenticated;
grant insert, delete on public.follows to authenticated;
