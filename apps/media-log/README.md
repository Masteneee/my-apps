# Media Log

One place to log, rate and review everything you watch, read and play: movies, series, anime, manga,
books and games. Think Letterboxd, but for every kind of media, with one profile. See `PLAN.md` for
the full plan and `LEARNING.md` for what each stage taught.

**Status:** Stage 4 (tracking + diary) done. One search bar finds movies and series (TMDB), anime and manga
(AniList), books (Open Library) and games (IGDB), merged into one list without duplicates. You can log any
of them with a status, rating, review and **progress** (episode 7/24, chapter 120/?, 45% of a book, 12.5
hours in a game), see them grouped by type on your profile at `/u/username`, read your **diary** (every log,
grouped by month) at `/u/username/diary`, and open any logged item's page at `/media/<type>/<source>-<id>`
(cover, info, your log with a progress tracker, everyone's average rating).

## Run it

```bash
cd apps/media-log
npm install
npm run dev        # open http://localhost:3000
```

With no `.env.local` the app runs in **demo mode**: a yellow strip says so, accounts, profiles and logs
are saved only in this browser's localStorage, and the Google button is disabled. Search uses small saved
**samples** for TMDB and IGDB until their keys are set, and for AniList and Open Library whenever they can't
be reached (the search page lists which sources use samples, and why). Everything else works.

## Commands (run inside `apps/media-log`)

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the app locally with live reload |
| `npm run lint` | Check the code with ESLint |
| `npm test` | Run the Vitest tests (logic in `lib/`) |
| `npm run build` | Production build (also type-checks everything) |
| `npm start` | Serve the production build |

GitHub Actions (`.github/workflows/media-log.yml`) runs lint, tests and build on every push that
touches this folder.

## Connect a real Supabase project

1. Create a free project at supabase.com.
2. SQL Editor > New query > paste `supabase/migrations/20261105000000_profiles.sql` > Run. Then do the
   same with `supabase/migrations/20261105010000_media_logs_lists_follows.sql` (order matters: the second
   file points to the `profiles` table), then `supabase/migrations/20261105020000_progress_units.sql`
   (Stage 4: adds `logs.progress_unit` and lets `progress` hold 12.5 hours). Table Editor should now show 6
   tables, each marked "RLS enabled", and `logs` should have a `progress_unit` column.
3. Project Settings > API: copy the Project URL and the anon (or "publishable") key.
4. `cp .env.example .env.local` and paste them in. Never use the `service_role` / secret key here.
5. Authentication > URL Configuration: Site URL `http://localhost:3000`, and add
   `http://localhost:3000/onboarding` to Redirect URLs (later also your Vercel URL + `/onboarding`).
6. Restart `npm run dev`. The demo strip disappears.

Sign up then sends a confirmation email by default; click the link and you land on the username page.
(For quick local testing you can turn off "Confirm email" under Authentication > Sign In / Providers > Email.)

### Google login (optional)
1. In Google Cloud Console, create an OAuth client ID (type "Web application") and add
   `https://<your-project>.supabase.co/auth/v1/callback` as an authorized redirect URI.
2. In Supabase: Authentication > Sign In / Providers > Google: turn it on, paste the client ID and secret.

The code is already wired (`lib/auth/supabase.ts`, `signInWithGoogle`).

## Connect TMDB (real movie and series search)

1. Create a free account at themoviedb.org, then Settings > API > request an API key (choose
   "Developer", describe it as a personal learning project).
2. On the same page, copy the **API Read Access Token** (the long one, recommended) or the shorter
   **API Key**.
3. In `.env.local`, set `TMDB_READ_ACCESS_TOKEN=...` (or `TMDB_API_KEY=...`). One is enough; if both are
   set, the token is used.
4. Restart `npm run dev`. TMDB disappears from the "Sample data" note on `/search`, and any movie or
   series can be found.

The key has no `NEXT_PUBLIC_` prefix, so it stays on the server: the browser calls our own `/api/search`,
and only that server code talks to TMDB. When deploying, add the same variable in Vercel's project settings.

## Connect IGDB (real game search)

IGDB belongs to Twitch, so its key is a Twitch developer app.
1. Log in at dev.twitch.tv/console (a free Twitch account; Twitch asks you to turn on two-factor
   authentication first).
2. Applications > **Register Your Application**: any name (e.g. `media-log-yourname`), OAuth Redirect URL
   `http://localhost`, Category "Application Integration", Client Type **Confidential**.
3. Open the app: copy the **Client ID**, click **New Secret** and copy the **Client Secret**.
4. In `.env.local`, set `IGDB_CLIENT_ID=...` and `IGDB_CLIENT_SECRET=...`, then restart `npm run dev`.

The server trades these for a temporary token at Twitch and remembers it (about 60 days), see
`lib/sources/igdb.ts`. Add both variables in Vercel too when deploying.

## AniList and Open Library

No key needed. When a live call fails (offline, the site is down, rate limit), the search quietly uses
that source's saved sample and the page says "couldn't reach it". The terminal running `npm run dev` logs
the reason. Set `MEDIA_LOG_USE_SAMPLES=1` in `.env.local` to force samples for **every** source (handy
offline).

## Test it by hand (demo mode)
1. `npm run dev`, open http://localhost:3000, click **Sign up**.
2. Enter any email and a 6+ character password. You land on **Pick a username**, prefilled from your email.
3. Type `ad` and see the "at least 3 characters" hint; type `admin` and see "reserved". Pick a valid
   one, e.g. `filmfan`, add a display name, save.
4. You're on `/u/filmfan` with "This is you" and the empty counters. Reload: still there.
5. Open `/u/nobody`: "No one here yet".
6. **Log out**, then open `/onboarding`: you're sent to `/login`. Log in with a wrong password (error),
   then the right one: you're back on your profile.
7. Narrow the window to phone width: the nav, header and counters rearrange without overflowing.

8. Logged in, click **Search** in the nav bar. The yellow "Sample data" note lists TMDB and IGDB ("no key
   set"). Search `dune` with **All**. With the samples you get the Dune movie and the Dune book first (exact
   title), then the Spice Wars game, Dune: Part Two, Dune II and Dune Messiah. Only **one** "Dune" book
   shows, though the Open Library sample has two entries for it. (Online, Open Library's real answer gives
   more books.) The note now also lists AniList and Open Library ("couldn't
   reach it") if you're offline.
9. Click the **Games** chip: the search re-runs and only the two games remain. Click **Books**, then **All**.
10. Search `spirited away`: only ONE Spirited Away, typed **Anime**, with "Studio Ghibli · 1 episode",
    although TMDB also has it as a movie (duplicates are merged). Search `attack on titan`: the anime and the manga
    ("Hajime Isayama · 141 chapters"), but not TMDB's series (same show as the anime).
11. Log the `interstellar` movie as **Watched**, 4.5 stars, with a review and "rewatch". A green message
    appears with a link.
12. Log the Dune **book**: the statuses say "Want to read / Reading / Read", the date field says
    "Finished on", the checkbox says "reread". Log *The Witcher 3* game as **Want to play** (rating greys
    out), and the Attack on Titan manga as **Reading** with 4 stars.
13. Open your profile: counters Movies 1, Manga 1, Books 1, Games 1, and one poster section per type, the
    game showing "Want to play". Reload: still there.
14. Log out and search again: results show "Log in to log this" instead of the button.
15. Search `zzz`: "Nothing found". With the **Anime** chip: "No anime found". Covers need internet;
    without it, each cover shows its title instead.

16. **Progress (Stage 4).** Search `berserk`, log the **manga** as **Reading**: a "Chapters read" box
    appears, "of ? chapters" (the sample has no total). Type `120`, save. Log the anime Spirited Away
    (1 episode) as **Watching** and type `2`: "It only has 1 episode...". Log the Dune book as **Reading**:
    switch the box to `%` and type `45`. Log *The Witcher 3* as **Finished** with `60.5` hours played, rated.
17. Open your profile: Berserk shows "Chapter 120/?" and the book "45%" under the poster. Click a poster:
    the **item page** opens with cover, info, "average from 1 rating" (or "No ratings yet") and **My log**.
18. On the Berserk page, press **+1 ch** twice: "Chapter 122/?". Log the Attack on Titan **anime** (25
    episodes) as **Watching** at `24`, open its page (link in the green message), press **+1 ep**: 25/25, the
    status turns to "Watched" by itself ("Marked as Watched"), dated today. Pick "Watching" again (number
    unchanged) and Save: it stays "Watching" (a rewatch isn't finished again right away).
19. On the Witcher page (rated), pick **Want to play** and Save: refused ("can't rate something you haven't
    played"). Press **Log it again** to add a second diary entry; the old one moves under "Earlier".
20. **Average rating:** log out, sign up a second account with a username, rate the same item differently.
    The item page now says "average from 2 ratings". Each person counts once (their latest rating).
21. **Diary:** on your profile click **Diary** (or open `/u/<you>/diary`): one section per month, newest
    first, with the day, poster, type, status, progress, review and stars. An item logged with a past
    "Watched on" date goes under THAT month. Open `/media/movie/tmdb-1`: "Not in Media Log yet".
    `/media/podcast/x`: the 404 page.

To reset demo data: DevTools > Application > Local Storage > delete `media-log:mock-db` (accounts) and
`media-log:mock-media` (logs).

## How it's organised

```
app/                 pages (folder = URL), layout, global CSS
app/api/             route handlers: server-only URLs that answer JSON (/api/search)
app/media/[type]/[id]/  the item page (/media/anime/anilist-16498)
app/u/[username]/diary/ the diary page
components/          React components (forms, nav bar, profile, diary, item page, progress tracker, search,
                     poster grid, AuthProvider, useProfileLogs hook)
lib/auth/            the AuthService interface + mock and Supabase backends + validation (+ tests)
lib/media/           the MediaStore interface (logs) + mock and Supabase stores + log validation, progress
                     math (progress.ts), diary grouping (diary.ts), item page links (links.ts) (+ tests)
lib/sources/         one adapter per search source (tmdb, anilist, openlibrary, igdb), merging + dedup,
                     the unified search, env setup, saved sample answers in samples/ (+ tests)
lib/supabase/        the one shared Supabase client
supabase/migrations/ SQL to paste into Supabase, in filename order
```

Pages never import Supabase directly: they call `getAuthService()` from `lib/auth` and `getMediaStore()`
from `lib/media`, which return the Supabase versions when both `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, and the localStorage demo versions otherwise.

Search: the page calls `GET /api/search?q=dune&type=all` (`app/api/search/route.ts`). On the server:
1. `lib/sources/server.ts` reads the keys and `lib/sources/setup.ts` picks, for each source, the real API
   or its saved sample (and a sample fallback for AniList and Open Library).
2. `lib/sources/unified.ts` asks every source that covers the chosen type, all at the same time. Each
   **adapter** (`tmdb.ts`, `anilist.ts`, `openlibrary.ts`, `igdb.ts`) calls its API and converts the answer
   into our one `MediaResult` type. A failing source doesn't stop the others.
3. `lib/sources/merge.ts` interleaves the types, merges duplicates, and puts exact title matches first.
4. The answer is `{ query, filter, results, sources }`, where `sources` says which source was live, used
   samples (and why) or failed (and why).

Item page: `/media/<type>/<source>-<source id>` (e.g. `/media/book/openlibrary-OL893415W`). The server part
(`app/media/[type]/[id]/page.tsx`) only checks the address (`lib/media/links.ts`); the browser part
(`components/MediaItemView.tsx`) asks the store for the cached item (`getMediaItem`) and everyone's logs of it
(`getLogsForItem`), and the tracker saves with `updateLog`. Only items someone has logged exist there (we
never copy whole catalogs); others show "Not in Media Log yet".
