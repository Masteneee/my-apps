-- Stage 4: progress tracking ("Episode 7/24", "Chapter 120/?", "45%", "12.5 hours").
--
-- How to use: run the two earlier files first, then: Supabase dashboard >
-- SQL Editor > New query > paste this whole file > Run. Running it twice is safe.
--
-- We ADD a new file instead of editing the Stage 2 one: a database that already
-- ran Stage 2 would never see edits to that file. Migrations are like a diary:
-- you only ever add new pages, in order.
--
-- What changes on `logs`:
-- 1. A new column `progress_unit` says what `progress` counts. Books can be
--    tracked in pages OR percent, so the unit can't be guessed from the type.
-- 2. `progress` becomes `numeric` (it was `int`) so games can have 12.5 hours.
--    Existing whole numbers are kept as they are.
-- 3. New rules (checks) so the database refuses nonsense even if the app has a bug.
--    KEEP IN SYNC with validateProgress() in lib/media/progress.ts.

-- 1. The unit. KEEP IN SYNC with PROGRESS_UNITS in lib/media/types.ts.
alter table public.logs
  add column if not exists progress_unit text
    check (progress_unit in ('episode', 'chapter', 'page', 'percent', 'hour'));

-- 2. int -> numeric. "using progress::numeric" tells Postgres how to convert old values.
--    The Stage 2 rule "progress >= 0" stays.
alter table public.logs
  alter column progress type numeric using progress::numeric;

-- Logs written before this migration may have a progress without a unit.
-- (The app never wrote any, but just in case: we can't guess the unit, so clear it.)
update public.logs set progress = null where progress is not null and progress_unit is null;

-- 3. The rules. "drop ... if exists" first, so running the file twice works
--    (Postgres has no "add constraint if not exists").
alter table public.logs drop constraint if exists logs_progress_unit_pair;
alter table public.logs add constraint logs_progress_unit_pair
  -- Both set, or both empty: a number without a unit means nothing.
  check ((progress is null) = (progress_unit is null));

alter table public.logs drop constraint if exists logs_progress_values;
alter table public.logs add constraint logs_progress_values
  check (
    progress is null
    or (
      progress <= 100000
      -- Hours may have one decimal (12.5); everything else is a whole number.
      and (
        (progress_unit = 'hour' and progress * 10 = floor(progress * 10))
        or (progress_unit <> 'hour' and progress = floor(progress))
      )
      -- A percentage stops at 100.
      and (progress_unit <> 'percent' or progress <= 100)
    )
  );

-- "progress <= total episodes" can't be a check here: the total lives in another
-- table (media_items), and checks only see one row. The app checks it instead.

-- No new policies needed: the Stage 2 policies already let you read every log
-- and update only your own, whatever the columns are.
