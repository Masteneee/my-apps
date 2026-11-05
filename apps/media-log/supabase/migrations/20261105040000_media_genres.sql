-- Stage 6: genres on media items, for stats ("top genres") and recommendations.
--
-- How to use: run the four earlier files first, then: Supabase dashboard >
-- SQL Editor > New query > paste this whole file > Run. Running it twice is safe.
-- (We never edit older files: a database that already ran them would never see
-- the change. Migrations only move forward.)
--
-- What it stores: each source's OWN genre words, as the search found them:
-- TMDB "Science Fiction", AniList "Sci-Fi" and "Space", Open Library
-- "Fiction, science fiction, general", IGDB "Science fiction". The app turns
-- them into one small shared tag set when it reads them (lib/media/tags.ts),
-- so improving that mapping later also improves items cached today.
--
-- Items cached before this migration get '{}' (an empty list = "unknown").
-- The app fills those in from its saved samples when it can (lib/sources/catalog.ts).

alter table public.media_items
  add column if not exists genres text[] not null default '{}';

-- The rules. "drop ... if exists" first, so running the file twice works.
-- KEEP IN SYNC with GENRES_MAX (12) and cleanGenres() in lib/sources/shared.ts.
alter table public.media_items drop constraint if exists media_items_genres_valid;
alter table public.media_items add constraint media_items_genres_valid
  check (
    -- cardinality() = how many elements the array has.
    cardinality(genres) <= 12
    -- No empty slots: array_position(..., null) finds the first null, if any.
    and array_position(genres, null) is null
    -- 12 words of at most 100 characters (plus the separators), so no giant text.
    and char_length(array_to_string(genres, '|')) <= 1211
  );

-- No new policies: the Stage 2 policies already let everyone read media items
-- and logged-in users insert them (with genres now), and still nobody can
-- update or delete a cached item.
