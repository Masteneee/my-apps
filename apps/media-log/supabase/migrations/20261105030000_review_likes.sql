-- Stage 5: likes on reviews.
--
-- follows, lists and list_items already exist (Stage 2 migration). The only new
-- table is review_likes: "this user liked this review".
--
-- How to use: run the three earlier files first (profiles, media/logs/lists/follows,
-- progress units), then: Supabase dashboard > SQL Editor > New query > paste
-- this whole file > Run. Running it twice is safe ("if not exists" / "drop ... if exists").
-- We never edit the older files: a database that already ran them would never
-- see the change. Migrations only move forward.


-- ---------------------------------------------------------------------------
-- review_likes
-- ---------------------------------------------------------------------------
create table if not exists public.review_likes (
  -- Who liked it. Deleting an account deletes its profile, which deletes its likes.
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  -- Which review (a review is a log with review_text). Deleting the log deletes its likes.
  log_id uuid not null
    references public.logs (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- You can like a given review only once.
  primary key (user_id, log_id)
);

-- "All likes of these reviews" (the feed and the item page count them).
-- The primary key already covers "what did this user like?".
create index if not exists review_likes_log_id_idx on public.review_likes (log_id);

alter table public.review_likes enable row level security;

-- Like counts are public, like on Letterboxd.
drop policy if exists "Review likes are readable by everyone" on public.review_likes;
create policy "Review likes are readable by everyone"
  on public.review_likes for select
  to anon, authenticated
  using (true);

-- You can only like as yourself, only a log that HAS a review, and never your own.
-- A `check` constraint can't do this (it only sees the row being saved, and the
-- review lives in another table, see Stage 4), but a policy CAN look at other
-- tables with "exists (select ...)". Same rules as likeProblem() in lib/media/feed.ts.
drop policy if exists "Users can like other people's reviews" on public.review_likes;
create policy "Users can like other people's reviews"
  on public.review_likes for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.logs l
      where l.id = log_id
        and l.review_text is not null
        and btrim(l.review_text) <> ''
        and l.user_id <> (select auth.uid())
    )
  );

-- Un-liking = deleting your own like. No update policy: there is nothing to edit.
drop policy if exists "Users can remove their own likes" on public.review_likes;
create policy "Users can remove their own likes"
  on public.review_likes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.review_likes to anon, authenticated;
grant insert, delete on public.review_likes to authenticated;
