-- =============================================================================
-- Demo account seed (Stage 7): fills ONE account with real, well-known titles,
-- so visitors of the deployed app (recruiters, friends) see a full profile,
-- diary, stats page, list and bridge picks instead of an empty app.
--
-- HOW TO RUN IT (once the 5 migrations in ../migrations/ have been run):
--   1. In the deployed app (or `npm run dev` with your Supabase keys), sign up
--      with an email you control and pick the username `demo`.
--   2. Supabase dashboard > SQL Editor > New query > paste this whole file > Run.
--   3. Open /u/demo: 15 logs, a diary over two years, /u/demo/stats, one list.
--
-- Safe by default:
--   - It only touches the account named in v_username below.
--   - If that account already has logs, it stops and changes nothing, unless
--     you set v_replace to true (then it deletes THAT account's logs and lists
--     and writes them again). So running it twice can't duplicate anything.
--   - No passwords, no keys: the account itself is created by signing up.
--
-- Why it works despite Row Level Security: the SQL Editor runs as the database
-- owner ("postgres"), and RLS policies apply to app users, not to the owner.
--
-- The media items are exactly what our search returns for them (the same
-- source ids, titles, covers and genres as the saved samples in
-- lib/sources/samples/), so logging Interstellar yourself later reuses the same
-- cached row. lib/demo/sql-seed.test.ts checks this, and checks every log
-- against the same rules as the log form (validateLogInput).
-- KEEP THE ONE-ROW-PER-LINE FORMAT: that test reads this file line by line.
--
-- The source ids were written from memory (no internet when this was built):
-- after running it, open a few item pages and check the covers load.
-- =============================================================================

do $$
declare
  v_username text := 'demo';   -- the username you picked when signing up
  v_replace boolean := false;  -- true = delete this account's logs + lists first
  v_user uuid;
  v_list uuid;
begin
  select id into v_user from public.profiles where username = v_username;
  if v_user is null then
    raise exception 'No profile with username "%". Sign up in the app and pick that username first.', v_username;
  end if;

  if exists (select 1 from public.logs where user_id = v_user) then
    if not v_replace then
      raise notice 'Account "%" already has logs: nothing changed. Set v_replace to true to rewrite them.', v_username;
      return;
    end if;
    -- Deleting a log also deletes its likes; deleting a list deletes its items (on delete cascade).
    delete from public.logs where user_id = v_user;
    delete from public.lists where user_id = v_user;
  end if;

  update public.profiles
  set display_name = 'Media Log demo',
      bio = 'Demo account with real logs, to show what Media Log does. Mostly movies, series and books, slowly crossing into anime, manga and games.'
  where id = v_user;

  -- 1) Cache the items, like the app does when someone logs them.
  --    "on conflict" = the item is already cached (someone logged it): keep it,
  --    only filling in genres if it was cached before Stage 6 (empty genres).
  insert into public.media_items as m (type, source, source_id, title, year, cover_url, creators, total_units, genres)
  values
    ('movie', 'tmdb', '157336', 'Interstellar', 2014, 'https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', array[]::text[], null, array['Adventure', 'Drama', 'Science Fiction']),
    ('movie', 'tmdb', '329865', 'Arrival', 2016, 'https://image.tmdb.org/t/p/w342/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg', array[]::text[], null, array['Drama', 'Science Fiction', 'Mystery']),
    ('movie', 'tmdb', '27205', 'Inception', 2010, 'https://image.tmdb.org/t/p/w342/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg', array[]::text[], null, array['Action', 'Science Fiction', 'Adventure']),
    ('movie', 'tmdb', '496243', 'Parasite', 2019, 'https://image.tmdb.org/t/p/w342/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', array[]::text[], null, array['Comedy', 'Thriller', 'Drama']),
    ('movie', 'tmdb', '438631', 'Dune', 2021, 'https://image.tmdb.org/t/p/w342/d5NXSklXo0qyIYkgV94XAgMIckC.jpg', array[]::text[], null, array['Science Fiction', 'Adventure']),
    ('movie', 'tmdb', '155', 'The Dark Knight', 2008, 'https://image.tmdb.org/t/p/w342/qJ2tW6WMUDux911r6m7haRef0WH.jpg', array[]::text[], null, array['Drama', 'Action', 'Crime', 'Thriller']),
    ('series', 'tmdb', '1396', 'Breaking Bad', 2008, 'https://image.tmdb.org/t/p/w342/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', array[]::text[], null, array['Drama', 'Crime']),
    ('series', 'tmdb', '95396', 'Severance', 2022, 'https://image.tmdb.org/t/p/w342/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg', array[]::text[], null, array['Drama', 'Mystery', 'Sci-Fi & Fantasy']),
    ('series', 'tmdb', '94605', 'Arcane', 2021, 'https://image.tmdb.org/t/p/w342/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg', array[]::text[], null, array['Animation', 'Drama', 'Action & Adventure', 'Sci-Fi & Fantasy']),
    ('book', 'openlibrary', 'OL21745884W', 'Project Hail Mary', 2021, 'https://covers.openlibrary.org/b/id/11200092-M.jpg', array['Andy Weir'], 496, array['Science fiction', 'Space flight', 'Astronauts', 'Interstellar travel', 'Fiction, science fiction, action & adventure', 'Humorous fiction']),
    ('book', 'openlibrary', 'OL893415W', 'Dune', 1965, 'https://covers.openlibrary.org/b/id/11481354-M.jpg', array['Frank Herbert'], 604, array['Science fiction', 'Life on other planets', 'Fiction, science fiction, general', 'Interplanetary voyages']),
    ('book', 'openlibrary', 'OL262758W', 'The Hobbit', 1937, 'https://covers.openlibrary.org/b/id/14627509-M.jpg', array['J.R.R. Tolkien'], 310, array['Fantasy fiction', 'Juvenile fiction', 'Dragons', 'Adventure stories']),
    ('anime', 'anilist', '154587', 'Frieren: Beyond Journey’s End', 2023, 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n1fmjRv4JQUd.jpg', array['MADHOUSE'], 28, array['Adventure', 'Drama', 'Fantasy', 'Iyashikei']),
    ('manga', 'anilist', '30044', 'Planetes', 1999, 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30044-xPLKKQAE3Gl0.jpg', array['Makoto Yukimura'], 26, array['Drama', 'Sci-Fi', 'Slice of Life', 'Space', 'Astronauts']),
    ('anime', 'anilist', '1', 'Cowboy Bebop', 1998, 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1-CXtrrkMpJ8Zq.png', array['Sunrise'], 26, array['Action', 'Adventure', 'Drama', 'Sci-Fi', 'Space', 'Noir']),
    ('game', 'igdb', '1942', 'The Witcher 3: Wild Hunt', 2015, 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg', array['CD Projekt RED'], null, array['Role-playing (RPG)', 'Adventure', 'Action', 'Fantasy', 'Open world']),
    ('game', 'igdb', '11737', 'Outer Wilds', 2019, 'https://images.igdb.com/igdb/image/upload/t_cover_big/co65ac.jpg', array['Mobius Digital'], null, array['Puzzle', 'Adventure', 'Indie', 'Science fiction', 'Mystery', 'Open world'])
  on conflict (source, type, source_id) do update
    set genres = excluded.genres
    where m.genres = '{}';

  -- 2) The logs. One row per line:
  --    (type, source, source_id, status, rating, progress, progress_unit, days_ago, rewatch, review)
  --    days_ago = how many days ago it was logged; for "completed" it's also the
  --    "Watched on" date. Dates are relative to today, so the diary and the
  --    yearly recap always look recent, whenever you run this.
  --    12 of the 15 are movies, series or books (80%), so this account gets
  --    bridge picks on the home page (the rule needs at least 75%).
  insert into public.logs (user_id, media_item_id, status, rating, progress, progress_unit, review_text, finished_at, rewatch, created_at)
  select
    v_user,
    m.id,
    l.status,
    l.rating::numeric,
    l.progress::numeric,
    l.progress_unit::text,
    l.review,
    case when l.status = 'completed' then current_date - l.days_ago::int end,
    l.rewatch,
    now() - make_interval(days => l.days_ago::int)
  from (values
    ('movie', 'tmdb', '157336', 'completed', 5, null, null, 2, true, 'Third time, still the docking scene. The science is shaky, the feelings are not.'),
    ('movie', 'tmdb', '329865', 'completed', 4.5, null, null, 9, false, 'A first-contact movie where the weapon is a dictionary. The ending changes every scene before it.'),
    ('movie', 'tmdb', '27205', 'completed', 4, null, null, 60, false, null),
    ('movie', 'tmdb', '496243', 'completed', 5, null, null, 150, false, 'Starts as a comedy, ends somewhere else entirely. Go in blind.'),
    ('movie', 'tmdb', '438631', 'completed', 4, null, null, 45, false, 'Huge, slow and loud in the best way. Now reading the book to catch what I missed.'),
    ('movie', 'tmdb', '155', 'completed', 4.5, null, null, 420, false, null),
    ('series', 'tmdb', '1396', 'completed', 5, null, null, 380, false, 'Five seasons, no bad one. The best slow change of a character on TV.'),
    ('series', 'tmdb', '95396', 'in_progress', null, 7, 'episode', 4, false, null),
    ('series', 'tmdb', '94605', 'completed', 4.5, null, null, 300, false, 'Looks like a painting in motion. Proof that animation is not just for kids.'),
    ('book', 'openlibrary', 'OL21745884W', 'completed', 5, null, null, 100, false, 'Funny science, big heart, and the best friendship in sci-fi. Read it before the movie.'),
    ('book', 'openlibrary', 'OL893415W', 'in_progress', null, 62, 'percent', 30, false, null),
    ('book', 'openlibrary', 'OL262758W', 'completed', 4, null, null, 500, true, null),
    ('anime', 'anilist', '154587', 'in_progress', null, 12, 'episode', 6, false, null),
    ('manga', 'anilist', '30044', 'planned', null, null, null, 3, false, null),
    ('game', 'igdb', '1942', 'paused', null, 40.5, 'hour', 200, false, 'Paused at 40 hours. Great stories, but it needs a whole summer.')
  ) as l(type, source, source_id, status, rating, progress, progress_unit, days_ago, rewatch, review)
  join public.media_items m on m.type = l.type and m.source = l.source and m.source_id = l.source_id;

  -- 3) One public list that shows the app's idea: the same feeling in 5 media types.
  insert into public.lists (user_id, title, description, is_public)
  values (v_user, 'Space, in every format', 'If you liked Interstellar, the same feeling exists as a book, a manga, an anime and a game.', true)
  returning id into v_list;

  --    (type, source, source_id, position)
  insert into public.list_items (list_id, media_item_id, position)
  select v_list, m.id, l.position::int
  from (values
    ('movie', 'tmdb', '157336', 0),
    ('book', 'openlibrary', 'OL21745884W', 1),
    ('manga', 'anilist', '30044', 2),
    ('anime', 'anilist', '1', 3),
    ('game', 'igdb', '11737', 4)
  ) as l(type, source, source_id, position)
  join public.media_items m on m.type = l.type and m.source = l.source and m.source_id = l.source_id;

  raise notice 'Done: % logs and 1 list for "%".', (select count(*) from public.logs where user_id = v_user), v_username;
end $$;
