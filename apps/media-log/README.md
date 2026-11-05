# Media Log

One place to log, rate and review everything you watch, read and play: movies, series, anime, manga,
books and games. Think Letterboxd, but for every kind of media, with one profile. See `PLAN.md` for
the full plan and `LEARNING.md` for what each stage taught.

**Status:** Stage 2 (database + movies) done. You can sign up, pick a username, search a movie, log it
with a status, rating and review, and see it in the poster grid on your profile at `/u/username`.

## Run it

```bash
cd apps/media-log
npm install
npm run dev        # open http://localhost:3000
```

With no `.env.local` the app runs in **demo mode**: a yellow strip says so, accounts, profiles and logs
are saved only in this browser's localStorage, and the Google button is disabled. Movie search uses a
saved **sample** of about a dozen movies until a TMDB key is set (the search page says so). Everything
else works.

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
   file points to the `profiles` table). Table Editor should now show 6 tables, each marked "RLS enabled".
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

## Connect TMDB (real movie search)

1. Create a free account at themoviedb.org, then Settings > API > request an API key (choose
   "Developer", describe it as a personal learning project).
2. On the same page, copy the **API Read Access Token** (the long one, recommended) or the shorter
   **API Key**.
3. In `.env.local`, set `TMDB_READ_ACCESS_TOKEN=...` (or `TMDB_API_KEY=...`). One is enough; if both are
   set, the token is used.
4. Restart `npm run dev`. The "Sample data" note on `/search` disappears and any movie can be found.

The key has no `NEXT_PUBLIC_` prefix, so it stays on the server: the browser calls our own
`/api/movies/search`, and only that server code talks to TMDB. When deploying, add the same variable in
Vercel's project settings.

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

8. Logged in, click **Search** in the nav bar. The yellow "Sample data" note shows. Search `interstellar`,
   click **Log it**. Pick **Want to watch**: the rating box greys out. Pick **Watched**, choose 4.5 stars,
   write a review, tick "rewatch", **Save to my log**. A green message appears with a link.
9. Search `parasite`, log it as **Want to watch** with no rating. Then log Interstellar again with 5 stars.
10. Open your profile: the Movies counter says **2**, the grid shows Interstellar (★★★★★, the newest log
    wins) and Parasite ("Want to watch"). Reload: still there.
11. Log out and search again: results show "Log in to log this movie" instead of the button.
12. Search `zzz`: "No movies found". Posters need internet; without it, each poster shows its title instead.

To reset demo data: DevTools > Application > Local Storage > delete `media-log:mock-db` (accounts) and
`media-log:mock-media` (logs).

## How it's organised

```
app/                 pages (folder = URL), layout, global CSS
app/api/             route handlers: server-only URLs that answer JSON (movie search)
components/          React components (forms, nav bar, profile view, search, poster grid, AuthProvider)
lib/auth/            the AuthService interface + mock and Supabase backends + validation (+ tests)
lib/media/           the MediaStore interface (logs) + mock and Supabase stores + log validation (+ tests)
lib/tmdb/            TMDB types, converter to our MediaResult, real + sample search, saved sample (+ tests)
lib/supabase/        the one shared Supabase client
supabase/migrations/ SQL to paste into Supabase, in filename order
```

Pages never import Supabase directly: they call `getAuthService()` from `lib/auth` and `getMediaStore()`
from `lib/media`, which return the Supabase versions when both `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, and the localStorage demo versions otherwise.

Movie search: the page calls `GET /api/movies/search?q=...` (`app/api/movies/search/route.ts`). On the
server, `lib/tmdb/server.ts` picks the real TMDB search when a TMDB key is set, or the saved sample
otherwise. Both go through the same converter (`lib/tmdb/convert.ts`) and answer
`{ results, usesSample }`.
