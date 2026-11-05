# LEARNING.md: Media Log

## Stage 1: Skeleton + accounts (2026-11-05)

### What we built
A Next.js app with a dark, responsive layout and a nav bar. You can sign up with email and password,
pick a username, and see your (empty) profile at `/u/username`. Login and logout work, and a "Continue
with Google" button is wired to Supabase. Because there is no Supabase project yet, the app has two
backends behind one interface: the real Supabase one (used when the keys are in `.env.local`) and a
fake "demo mode" one that saves everything in your browser. A SQL file creates the `profiles` table
with Row Level Security, ready to paste into Supabase. A GitHub Actions workflow runs lint, tests and
the build on every push.

### New concepts

**Next.js and the App Router.** Next.js is a framework on top of React. With the App Router, folders in
`app/` become URLs: `app/login/page.tsx` is `/login`. `app/layout.tsx` wraps every page, which is why
the nav bar shows up everywhere without being repeated in each page.

**Dynamic routes.** A folder name in square brackets, like `app/u/[username]/`, matches any value.
Visiting `/u/filmfan` runs that one page with `params.username = "filmfan"`. That's how every user gets
a profile page without us making a file per user.

**Server Components vs Client Components.** By default a component runs on the server and is sent to
the browser as plain HTML (fast, no JavaScript). A file starting with `"use client"` also runs in the
browser, so it can use clicks, typing, `useState` and `localStorage`. Our forms, the nav bar and the
profile view are client components because they need the login session, which lives in the browser.

**React state, effects and context.** `useState` stores a value that, when changed, redraws the
component (like the text in an input). `useEffect` runs code after the component appears, for things
like "load this profile" or "redirect to /login". `createContext` + `useAuth()` (in
`components/AuthProvider.tsx`) share "who is logged in" with every component, instead of passing it
down by hand through each one.

**An interface with two implementations.** `lib/auth/types.ts` defines `AuthService`: a list of
functions (sign up, sign in, create profile...) without saying how they work. `mock.ts` and
`supabase.ts` both follow that list. `lib/auth/index.ts` picks one, and the pages only ever call
`getAuthService()`. So when you add your Supabase keys, no page needs to change. Stage 3 uses the same
idea for search sources (it's called the adapter pattern).

**Supabase Auth.** Supabase is a hosted Postgres database plus a login system. It stores passwords
safely (hashed), handles "confirm your email" links and Google login, and gives the browser a session
token. We never see or store passwords ourselves in Supabase mode.

**Row Level Security (RLS).** The browser talks to the database directly using a public "anon" key, so
anybody could copy that key. RLS is what keeps data safe anyway: with it on, every row is locked unless
a *policy* allows the action. Our policies say "anyone can read profiles" and "you can only insert or
update the row whose `id` equals your own user id (`auth.uid()`)". The checks in our TypeScript are
just for friendly messages; RLS is the real lock.

**Environment variables.** Settings that change between computers (like API keys) live in `.env.local`,
which git ignores, so secrets never end up on GitHub. `.env.example` lists the names with no values.
Variables starting with `NEXT_PUBLIC_` are copied into the browser code, so only put public values
there (the anon key is public by design; the `service_role` key never is).

**localStorage.** A small key-value store built into every browser. The demo backend saves a JSON
"database" under one key (`media-log:mock-db`). It survives reloads but stays in that one browser.
You can see it in DevTools > Application > Local Storage.

**Tests with a fake storage (dependency injection).** `createMockAuthService(storage)` receives the
storage as an argument instead of grabbing `window.localStorage` itself. In the browser we pass
localStorage; in tests we pass `createMemoryStorage()`, a plain JavaScript `Map`. That's why the tests
run in Node in a fraction of a second, with no browser.

**ESLint and GitHub Actions.** ESLint reads the code and flags common mistakes (like breaking React's
hook rules). GitHub Actions is a free computer at GitHub that runs `npm ci`, lint, tests and build each
time you push, and shows a red X on the commit if something broke.

### New dependencies (and why)
- `next`, `react`, `react-dom`: the framework and the UI library (the default stack).
- `@supabase/supabase-js`: talks to Supabase (login, sessions, database). Writing this ourselves would
  mean handling tokens, refresh and Google's OAuth flow by hand.
- `typescript`, `@types/node`, `@types/react`, `@types/react-dom` (dev only): type checking.
- `tailwindcss` + `@tailwindcss/postcss` (dev only): the styling classes, plugged into the build.
- `eslint` + `eslint-config-next` (dev only): `npm run lint` with Next.js's recommended rules.
- `vitest` (dev only): runs the tests.

We did NOT add `@supabase/ssr` (server-side sessions). Everything that needs the session runs in the
browser, which keeps this stage simpler. We may add it later if we need server-side pages.

### Files and what each one does
- `package.json` / `package-lock.json` dependencies and the `npm run ...` scripts.
- `tsconfig.json` TypeScript settings; `@/` means "the app folder" in imports.
- `next.config.ts` Next.js settings (empty for now).
- `postcss.config.mjs` plugs Tailwind into the build.
- `eslint.config.mjs` lint rules.
- `vitest.config.mts` tells Vitest to run `lib/**/*.test.ts` in Node.
- `.gitignore` keeps `node_modules/`, `.next/` and `.env.local` out of git.
- `.env.example` the two Supabase settings, empty.
- `supabase/migrations/20261105000000_profiles.sql` the `profiles` table, its rules and RLS policies.
- `lib/auth/types.ts` the `AuthService` interface and the `AuthUser` / `Profile` types.
- `lib/auth/validation.ts` username, display name, email and password checks, plus username suggestions.
- `lib/auth/mock.ts` the demo backend (localStorage).
- `lib/auth/supabase.ts` the real backend, plus turning Supabase errors into friendly sentences.
- `lib/auth/index.ts` picks the backend from the environment variables.
- `lib/auth/*.test.ts` 39 tests for the files above.
- `app/layout.tsx` the frame around every page (banner, nav bar, `<main>`).
- `app/globals.css` loads Tailwind and sets the dark colour scheme.
- `app/icon.svg` the browser tab icon.
- `app/page.tsx` home page.
- `app/signup/page.tsx`, `app/login/page.tsx` the two account pages.
- `app/onboarding/page.tsx` "pick a username", or forwards you to your profile.
- `app/u/[username]/page.tsx` the public profile route.
- `app/not-found.tsx` the 404 page.
- `components/AuthProvider.tsx` shares the logged-in user and their profile with every component.
- `components/NavBar.tsx` top bar with Log in / Sign up or My profile / Log out.
- `components/DemoBanner.tsx` the yellow "demo mode" strip.
- `components/AuthForm.tsx` the email + password form used by both login and sign up.
- `components/GoogleButton.tsx` "Continue with Google" (disabled in demo mode).
- `components/UsernameForm.tsx` username + display name form with live validation.
- `components/ProfileView.tsx` the profile page content (avatar letter, name, counters, empty state).
- `../../.github/workflows/media-log.yml` the CI workflow.

### Most important lines
```ts
return url?.trim() && anonKey?.trim() ? "supabase" : "mock";
```
In `lib/auth/index.ts`: both Supabase values filled in means the real backend, anything else means demo
mode. This single line is why the app works with zero setup.

```sql
with check ((select auth.uid()) = id);
```
In the SQL file: a new profile row is only accepted if its `id` is the id of the person sending the
request. Nobody can create a profile for someone else, even with the public key.

```ts
const profileIsCurrent = loaded !== null && loaded.userId === userId;
```
In `AuthProvider.tsx`: we remember which user a loaded profile belongs to, so after logging out and in
as someone else we never show the previous person's profile for a split second.

### Decisions
- Usernames are stored lowercase and checked by the same rule in TypeScript and in SQL
  (`^[a-z][a-z0-9_]{2,19}$`), so `/u/FilmFan` and `/u/filmfan` are the same page.
- Every sign in (email or Google) lands on `/onboarding`, which decides: pick a username, or go to your
  profile. One place for that logic instead of three.
- Profiles are loaded in the browser, not on the server, because in demo mode the data only exists in
  the browser. The cost: the profile page shows "Loading..." for a moment.
- Dark theme only for now (no toggle), as the plan asks for "dark theme".
- Demo mode stores passwords in plain text in localStorage. That's acceptable only because it's a
  throwaway local demo; Supabase mode never stores passwords in the app.

### Practice exercise
Add `"movies"` to the reserved usernames in `lib/auth/validation.ts`. Then add a test in
`lib/auth/validation.test.ts` that checks `validateUsername("Movies")` is not ok, and run `npm test`.
Bonus: in the browser (demo mode), open DevTools > Application > Local Storage, find
`media-log:mock-db`, and read the JSON. Can you spot your profile? Why is it a bad idea to keep real
passwords there?

### Quiz
1. Why is it safe that the Supabase anon key is visible in the browser code?
2. What would break if `app/u/[username]` were named `app/u/username` (no brackets)?
3. Why does `createMockAuthService` take `storage` as an argument?

Answers
1. The anon key can only do what the RLS policies allow: read profiles, and create or edit only your own.
2. It would only match the exact URL `/u/username`, not `/u/filmfan`.
3. So tests can give it a fake in-memory storage and run without a browser.

## Stage 2: Database + movies (2026-11-05)

### What we built
You can now search for a movie, log it with a status (Want to watch, Watched, Dropped...), a rating
from half a star to 5 stars, a review, a "watched on" date and a rewatch flag, then see it in a poster
grid on your profile. The Movies counter on the profile is real. A second SQL file creates the rest of
the data model from PLAN.md (`media_items`, `logs`, `lists`, `list_items`, `follows`), every table with
Row Level Security. Lists and follows have no screens yet (Stage 5), but their tables and rules exist.

Same trick as Stage 1, used twice:
- **Logs** go through a `MediaStore` interface with a Supabase version and a localStorage demo version.
- **Movie search** goes through a `MovieSearch` interface with a real TMDB version (when a TMDB key is
  set) and a "saved sample" version (about a dozen famous movies, used when no key is set). The search
  page shows a yellow "Sample data" note in that case.

### New concepts

**Tables that point to each other (foreign keys).** A log doesn't copy the movie's title; it stores
`media_item_id`, the id of a row in `media_items`. `references public.media_items (id)` makes Postgres
refuse a log that points to a movie that doesn't exist. `on delete cascade` means "if the thing I point
to is deleted, delete me too", so deleting an account cleans up its profile, logs, lists and follows.

**Constraints: letting the database say no.** `unique (source, type, source_id)` means the same TMDB
movie is cached only once, no matter how many people log it. `check (...)` rules refuse bad values even
if our TypeScript has a bug: the rating must be between 0.5 and 5 and `rating * 2` must be a whole
number (that's "half steps" in math form). A primary key made of two columns, like
`primary key (follower_id, following_id)`, means "you can follow someone only once".

**Indexes.** An index is like the index at the back of a book: instead of reading every log to find
yours, Postgres jumps straight to them. We add one for "this user's logs, newest first" (the profile
page) and one for "all logs of this movie" (needed for average ratings in Stage 4).

**RLS, part 2: `using` vs `with check`, and policies that look at another table.** Stage 1 explained
RLS (every row locked unless a policy allows it). Two new ideas: `using (...)` decides which EXISTING
rows you may see, update or delete; `with check (...)` decides whether a NEW or CHANGED row is allowed.
The update policy on `logs` has both, so you can't edit someone else's log, and you can't edit yours
to hand it to someone else. `list_items` has no `user_id`, so its policies ask "does this item's list
belong to you?" with `exists (select 1 from lists l where l.id = list_id and l.user_id = auth.uid())`.
Lists also show a policy that depends on the data: `is_public or auth.uid() = user_id` (public lists
for everyone, private ones only for you).

**Route Handlers: code that only runs on the server.** `app/api/movies/search/route.ts` is a URL that
returns JSON instead of a page. The browser calls `/api/movies/search?q=interstellar`; our server then
calls TMDB with the key and sends back the results. The key lives in `process.env.TMDB_READ_ACCESS_TOKEN`
(no `NEXT_PUBLIC_` prefix), so Next.js never copies it into browser code. `import "server-only"` in
`lib/tmdb/server.ts` is a safety net: the build fails if a browser component ever imports that file.

**Converting outside data into our own type.** TMDB says `release_date: "2014-11-05"` and
`poster_path: "/abc.jpg"`; our app wants `year: 2014` and a full `coverUrl`. `lib/tmdb/convert.ts` is the
only file that knows TMDB's field names. The sample search returns data in TMDB's exact shape and goes
through the same converter, so the sample really tests the real path. This is the start of the adapter
pattern that Stage 3 builds on (one converter per source, all producing `MediaResult`).

**Don't trust data from the internet: `unknown` and type guards.** `convertTmdbSearchResponse` takes
`json: unknown`, which forces us to check before using it. `looksLikeMovie(value): value is TmdbMovie` is
a "type guard": it checks the value at runtime, and if it returns true, TypeScript treats the value as a
`TmdbMovie`. Broken entries are skipped instead of crashing the page.

**Caching only what's used.** We never copy TMDB's catalog. The first time anyone logs a movie, we save
a small copy (`media_items`) so profiles load without asking TMDB again. The Supabase store first looks
for the cached copy, and only inserts if there is none (and if two people insert at the same moment,
the unique rule makes one fail with code `23505`, and that one just reads the other's copy).

**Fake `fetch` in tests.** `createTmdbMovieSearch(credentials, fetchFn)` takes `fetch` as a parameter
(dependency injection again, like the storage in Stage 1). Tests pass `vi.fn(...)`, a fake that answers
with the saved sample, and can check which URL was called. No internet, no key, same result every time.

**Numbers with decimals are tricky.** In JavaScript `0.1 + 0.2` is `0.30000000000000004`, because
computers store numbers in binary and 0.1 has no exact binary form (like 1/3 in decimal). Halves are
safe (0.5 is exactly 1/2 in binary), so `Number.isInteger(value * 2)` is an exact "is it a half step?"
check. If we ever wanted 0.1 steps, this trick would break and we'd compare with a small tolerance
instead. The SQL rule is written the same way (`rating * 2 = floor(rating * 2)`), so both sides agree.

**Local date vs UTC.** `new Date().toISOString()` gives the date in London's time zone (UTC). At 9 p.m. in
Montreal that's already "tomorrow", so the "watched on" field would default to the wrong day.
`localToday()` builds the date from `getFullYear()`, `getMonth()` and `getDate()`, which use your own
time zone.

**`useRef` for "which answer is the latest?"** If you search "matrix" then quickly "parasite", the
answers can come back in the wrong order. `MovieSearch` numbers each request in a `useRef` (a value React
keeps between renders without redrawing) and ignores any answer that isn't for the latest number.

### New dependencies
None. `server-only` is handled by Next.js itself, and Vitest's `vi.fn` was already installed.

### Files and what each one does
- `supabase/migrations/20261105010000_media_logs_lists_follows.sql` the 5 new tables, their rules,
  indexes and RLS policies. Run it after the profiles file.
- `lib/media/types.ts` `MediaResult` (a search result), `MediaItem` and `Log` (database rows), and the
  `MediaStore` interface.
- `lib/media/validation.ts` rating check, `validateLogInput` (all form rules in one place), dates.
- `lib/media/display.ts` stars text, status words, "newest log per movie", counts per type.
- `lib/media/mock.ts` the demo store (localStorage key `media-log:mock-media`).
- `lib/media/supabase.ts` the real store, plus friendly database error messages.
- `lib/media/index.ts` picks the store (same rule as auth).
- `lib/supabase/client.ts` the ONE Supabase client, now shared by auth and the media store.
- `lib/auth/supabase.ts`, `lib/auth/index.ts` changed to use that shared client instead of making their own.
- `lib/tmdb/types.ts` the shape of TMDB's search answer.
- `lib/tmdb/convert.ts` TMDB answer -> `MediaResult[]`.
- `lib/tmdb/search.ts` the `MovieSearch` interface, the real TMDB search, the sample search, and
  building the TMDB request (token in a header, or API key in the URL).
- `lib/tmdb/sample-search-response.json` the saved sample: 13 movies in TMDB's exact format.
- `lib/tmdb/server.ts` server-only: reads the TMDB key from the environment and picks real or sample.
- `lib/**/*.test.ts` 54 new tests (93 in total): converter, TMDB request + fake fetch, sample search,
  rating and log validation, the demo store, display helpers.
- `app/api/movies/search/route.ts` the route handler `GET /api/movies/search?q=...`.
- `app/search/page.tsx` the `/search` page.
- `components/MovieSearch.tsx` search box, sample-data note, results, success message.
- `components/LogMovieForm.tsx` status, rating, date, rewatch, review.
- `components/Poster.tsx` a poster image that falls back to the title if it can't load.
- `components/PosterGrid.tsx` the profile's poster grid.
- `components/ProfileView.tsx` now loads the user's logs: real counters and the grid.
- `components/NavBar.tsx` new "Search" link. `components/DemoBanner.tsx` mentions logs.
- `.env.example` new `TMDB_READ_ACCESS_TOKEN` and `TMDB_API_KEY`.

### Most important lines
```sql
rating numeric check (rating between 0.5 and 5 and rating * 2 = floor(rating * 2)),
```
In the migration: the database itself refuses 3.3 stars or 7 stars, whatever the browser sends.

```ts
return credentials ? createTmdbMovieSearch(credentials) : createSampleMovieSearch();
```
In `lib/tmdb/server.ts`: one line decides real TMDB or the sample. The page never knows the difference,
except for the `usesSample` flag that shows the note.

```ts
const LOG_WITH_MEDIA_COLUMNS = `${LOG_COLUMNS}, media:media_items(${MEDIA_COLUMNS})`;
```
In `lib/media/supabase.ts`: one request gets the logs AND the movie each one points to (Supabase follows
the foreign key for us), instead of one extra request per poster.

### Decisions
- `media_items` is unique on `(source, type, source_id)`, not `(source, source_id)` as PLAN.md says,
  because TMDB numbers movies and series separately (movie 550 and series 550 are different things).
- Logging the same movie twice makes two diary entries (that's what a rewatch is). The poster grid and
  the counter show each movie once, using the newest log.
- You can't rate a movie marked "Want to watch". The watched date and rewatch flag are only kept for
  "Watched".
- Logs and follows are readable by everyone (public diaries, like Letterboxd). Private lists are only
  readable by their owner.
- Any logged-in user may add to `media_items`, but nobody can edit or delete a cached item, since other
  people's logs point to it.
- `creators` is empty for movies for now: TMDB's search answer has no director (it needs a second
  request per movie). Stage 3 or 4 can fill it.
- Posters use a plain `<img>`, not Next.js's `<Image>`, to avoid extra config. Stage 7 is the
  performance pass.
- The sample's numbers (popularity, votes) are approximate, and the overviews are written by us.
  The poster addresses are real TMDB paths as far as we know, but couldn't be checked offline; a broken
  one just shows the title.
- TMDB's terms ask for a credit line, so the search page has one.

### Practice exercise
Add a movie to the sample: in `lib/tmdb/sample-search-response.json`, copy one movie block and change it
to *Amélie* (`"id": 194`, `"title": "Amélie"`, `"original_title": "Le Fabuleux Destin d'Amélie Poulain"`,
`"release_date": "2001-04-25"`, `"original_language": "fr"`, `"poster_path": null`). Don't forget the
comma between blocks and update `total_results`. Then add a test in `lib/tmdb/search.test.ts` checking
that searching `amelie` (no accent!) finds it, and run `npm test`. Bonus: why does the poster show the
title instead of an image? (Look at `posterUrl` and `Poster.tsx`.)

### Quiz
1. Why does the browser call `/api/movies/search` instead of calling TMDB directly?
2. A hacker sends `insert into logs (user_id, ...) values ('<your id>', ...)` with their own login.
   What stops it?
3. Why does the sample search go through `convertTmdbSearchResponse` instead of returning
   `MediaResult`s directly?

Answers
1. Calling TMDB from the browser would need the key in the browser, where anyone can read it. The route
   handler keeps it on the server.
2. The insert policy on `logs`: `with check ((select auth.uid()) = user_id)`. Their `auth.uid()` isn't
   your id, so the row is refused.
3. So the sample exercises the exact same code as the real API. If the converter breaks, sample mode
   breaks too, and the tests catch it.

## Stage 3: Unified search (2026-11-05)

### What we built
One search bar for everything. Type `dune` and you get the Dune movie, the Dune book and the Dune games in
one list; chips filter it to one type (All, Movies, Series, Anime, Manga, Books, Games). Four sources are
behind it: TMDB (movies and series), AniList (anime and manga), Open Library (books) and IGDB (games).
When the same thing is found twice (Spirited Away is a TMDB movie AND an AniList anime) it shows once.
You can log any result: the form says "Want to read / Reading / Read" for books, "Want to play / Playing /
Finished" for games, and the profile shows one poster section per type.

Every source also has a **saved sample** of its real answers. TMDB and IGDB use it when their key is
missing; AniList and Open Library (no key needed) use it when the live call fails; and
`MEDIA_LOG_USE_SAMPLES=1` forces it everywhere. The search page lists which sources use samples, and why.

### The plan we followed
1. Move the Stage 2 TMDB code into `lib/sources/`, add series (`/search/tv`), and move the helpers every
   source needs (cleaning text, friendly HTTP errors) into `shared.ts`.
2. Write one `SourceAdapter` contract, then `anilist.ts`, `openlibrary.ts`, `igdb.ts`, each with a live
   version and a sample version that go through the same converter.
3. Write the merge rules as pure functions (`merge.ts`): take turns between types, merge duplicates, best
   title matches first.
4. Run all sources at once (`unified.ts`), choose live/sample from the env (`setup.ts`, `server.ts`), and
   replace `/api/movies/search` with `/api/search`.
5. Make the search page, the log form and the profile work for every type.
6. Tests for every adapter (saved samples, fake `fetch`), the merging and the setup; then the docs.

### New concepts

**The adapter pattern (the big one).** A travel adapter lets a Canadian plug fit a European socket
without changing either. Our adapters do the same with data: each one knows ONE outside API and converts
its answers into our ONE shape, `MediaResult`. TMDB says `release_date`, IGDB says `first_release_date` in
seconds, Open Library says `first_publish_year`; after the adapter, it's just `year` for everyone.

**Why the adapter pattern matters HERE.** Without it, the search page, the merge rules, the log form and
the database code would all need `if TMDB ... else if AniList ...` everywhere, and adding a fifth source
(say, podcasts) would mean touching all of them. With it, everything after the adapters only knows
`MediaResult`, and a new source = one new adapter file + one line in `setup.ts`. It also keeps each API's
weirdness in one place: when IGDB changes a field name, only `igdb.ts` changes. And because every adapter
has the same shape (`source`, `types`, `mode`, `search()`), the unified search can treat them all the same
way, including the sample versions, which are just more adapters.

**Interfaces as contracts (again).** `SourceAdapter` in `lib/sources/types.ts` is the same idea as
`AuthService` (Stage 1) and `MediaStore` (Stage 2): a list of what something must offer, without saying
how. TypeScript refuses an adapter that forgets `types` or returns the wrong thing from `search()`.

**GraphQL (AniList).** A normal ("REST") API has one address per question (`/search/movie`,
`/search/tv`). GraphQL has ONE address, and you POST a query listing exactly the fields you want; the
answer has the same shape as the query. Two GraphQL tricks we use: **aliases** (`anime: Page(...)` and
`manga: Page(...)` ask two questions in one request) and **variables** (`$search`), so the search text is
never glued into the query text.

**Escaping (and why gluing text is dangerous).** IGDB's query language puts the search text between
double quotes: `search "zelda";`. If someone searches `say "hi"`, the quote in the middle would end the
text early and break the query (or worse, add instructions of their own; that's how "injection" attacks
work). `buildIgdbQuery` escapes it (`\"`). AniList avoids the problem entirely with variables, and
`URLSearchParams` does the same job for TMDB and Open Library addresses.

**Running things in parallel, and surviving failures.** `Promise.all([...])` starts all the searches at
once and waits for all of them, so a search takes as long as the SLOWEST source, not the sum of all four.
But `Promise.all` gives up as soon as one promise fails, so `searchOneSource` catches every error itself
and returns it as a status instead. Result: if IGDB is down, you still get movies and books, plus a red
"IGDB: ..." line.

**Fallbacks ("graceful degradation").** When something fails, do the next best thing instead of showing
nothing. AniList and Open Library fall back to their samples when the live call fails. TMDB and IGDB do
NOT fall back when a key is set but wrong: hiding that would make you think your key works. The yellow
note always says which sources use samples and why, so you're never fooled by fake-looking results.

**Timeouts.** `AbortSignal.timeout(8000)` cancels a request after 8 seconds. Without it, one source that
never answers would keep the whole search spinning forever.

**Caching a token in memory (IGDB).** IGDB needs a temporary "access token" from Twitch, valid for about
60 days. Asking for a new one on every search would be slow and rude. `createTwitchTokenProvider` keeps it
in a variable and only asks again a minute before it expires. `server.ts` creates the provider OUTSIDE the
request function, so it lives as long as the server process (a module is loaded once).

**Your own Error class.** `class SourceError extends Error` is an Error with one extra field, `kind`
("refused", "rate-limited", ...). `extends` means "everything an Error has, plus this". The IGDB adapter
checks `err.kind === "refused"` to forget a bad token, which is safer than searching the message text
(someone could reword the message one day).

**Deduplication: deciding "same thing".** Two results are the same item if they share a title (ignoring
case, accents, punctuation; the original title counts too), their types can match (same type, or anime vs
TMDB movie/series), and they have the same year. Remakes (Dune 1984 vs 2021) differ by year, so both stay.
When a year is missing we only merge with a shared creator (same author). When merging, the anime version
wins (it has the episode count and studio) and blanks are filled from the other copy.

**Ranking with a stable sort.** `matchScore` gives 3 for an exact title, 2 for "starts with", 1 for "has
the word", 0 otherwise. Sorting by score keeps equal scores in their previous order (JavaScript's sort is
"stable"), and that previous order is the type-by-type interleaving, so no source can flood the top.

### New dependencies
None. GraphQL is just a POST with JSON (no GraphQL library needed), and everything else uses `fetch`.

### Files and what each one does
- `lib/sources/types.ts` the `SourceAdapter` contract, search filters, `SourceStatus`, `UnifiedSearchResponse`.
- `lib/sources/shared.ts` helpers every adapter uses: `cleanQuery`, `normalizeText`, `cleanYear` (follows the
  database's 1800-2200 rule), `stripHtml`, `fetchJson` (friendly errors + timeout), `SourceError`.
- `lib/sources/tmdb.ts` TMDB adapter: movies AND series now (was `lib/tmdb/` in Stage 2, moved and merged).
- `lib/sources/anilist.ts` AniList adapter (GraphQL): anime and manga.
- `lib/sources/openlibrary.ts` Open Library adapter: books.
- `lib/sources/igdb.ts` IGDB adapter: games, plus the Twitch token step and its memory.
- `lib/sources/samples/*.json` saved answers in each API's real shape: `tmdb-search-movie.json` (16 movies),
  `tmdb-search-tv.json` (10 series), `anilist-search.json` (9 anime + 6 manga), `openlibrary-search.json`
  (12 books), `igdb-games.json` (11 games).
- `lib/sources/merge.ts` interleave by type, dedupe, rank by title match (pure functions).
- `lib/sources/unified.ts` runs the right sources in parallel, handles failures and fallbacks, merges.
- `lib/sources/setup.ts` env variables -> which version of each source (live, sample, fallback).
- `lib/sources/server.ts` server-only: reads the env, keeps the IGDB token between searches.
- `lib/sources/*.test.ts` tests for each adapter (saved samples + fake `fetch`, no live calls), shared
  helpers, merging, the unified search and the setup.
- `app/api/search/route.ts` `GET /api/search?q=...&type=...` (replaces `/api/movies/search`).
- `components/MediaSearch.tsx` (was `MovieSearch.tsx`) filter chips, search box, sample/error notes,
  results with type, creators and episodes/chapters/pages.
- `components/LogMediaForm.tsx` (was `LogMovieForm.tsx`) the same form, with words for each type.
- `components/ProfileView.tsx` one poster section per type. `components/PosterGrid.tsx` per-type status words.
- `app/search/page.tsx` uses `MediaSearch`.
- `lib/media/display.ts` `TYPE_LABELS`, `wordsFor`, `statusLabel`, `unitsLabel`, `groupByType` (replace
  `MOVIE_STATUS_LABELS`). `lib/media/validation.ts` messages no longer say "watched" only.
- `lib/media/*.test.ts` tests for the new helpers, and a demo-store test logging all six types.
- `.env.example` new `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`, `MEDIA_LOG_USE_SAMPLES`.
- Removed: `lib/tmdb/` (moved into `lib/sources/`), `app/api/movies/search/route.ts`.

Tests: 185 in 14 files (93 before this stage).

### Most important lines
```ts
search(query: string, options: SourceSearchOptions): Promise<MediaResult[]>;
```
In `lib/sources/types.ts`: the whole adapter pattern in one line. Whatever the API, the answer is a list
of OUR type.

```ts
const answers = await Promise.all(active.map(({ entry, types }) => searchOneSource(entry, query, { types, limit }, warn)));
```
In `lib/sources/unified.ts`: all sources at once, and `searchOneSource` never throws, so one broken
source can't hide the others.

```ts
if (a.year !== null && b.year !== null) return a.year === b.year;
```
In `lib/sources/merge.ts`: the line that keeps Dune (1984) and Dune (2021) apart while merging Spirited
Away (2001) from TMDB and AniList.

### Decisions
- **Anime beats movie/series when merging.** Spirited Away appears once, as anime (AniList has the episode
  count and studio). To log it as a movie instead, pick the **Movies** chip: AniList isn't asked then.
- **A manga and its anime are never merged**, nor a book and its film: they're different things to log.
- **Light novels are skipped from AniList** (`format_not: NOVEL`): they're books, and Open Library covers
  books, so they'd be listed twice with different types.
- **Keyed sources don't fall back on errors.** A wrong TMDB/IGDB key shows a red error instead of quietly
  showing samples, so you notice and fix it.
- **8 results per type with "All", 20 with one type**, so "All" stays readable.
- **Years before 1800 become "unknown"** (the database refuses them): Don Quixote (1605) can still be
  logged. Counts of 0 become unknown too (the database wants more than 0).
- **Adult content is filtered where the API allows it:** AniList is asked `isAdult: false`, TMDB `include_adult=false`,
  IGDB excludes the "Erotic" theme. Open Library has no such flag.
- **Creators:** anime = main studio, manga = writer/artist (not translators), books = authors, games = the
  developer (not the publisher). TMDB still has none (its search has no director).
- **Sample data is from memory, not downloaded** (the build had no internet). The shapes follow each
  API's documentation; ids, cover addresses and numbers may be slightly off, and the descriptions are
  written by us. A broken cover just shows the title.
- **Live calls are written but untested against the real APIs** (no internet here). They're tested with
  fake `fetch` answers in the real shapes; try them once with internet and keys (see SETUP-NEEDED.md).
- The old `/api/movies/search` route was removed rather than kept next to the new one: only our own page
  used it.

### Practice exercise
Improve the merge rules: right now `isSameItem` thinks "The Hobbit" and "Hobbit" (same year, same author)
are different books. In `lib/sources/merge.ts`, write a small function `withoutLeadingArticle`
that turns `"the witcher"` into `"witcher"` (also `"a "` and `"an "`), and use it inside `titleKeys`. Then
add a test in `merge.test.ts`: `isSameItem` of two books "The Hobbit" (1937, Tolkien) and "Hobbit" (1937,
Tolkien) should be `true`. Run `npm test`. Bonus: does `matchScore("the hobbit", ...)` still give 3 for
"The Hobbit"? Why?

### Quiz
1. Adding a podcast source next month: which files must change, and which must NOT?
2. Why does `searchOneSource` catch errors instead of letting `Promise.all` see them?
3. Why does the IGDB secret never appear in the request to `api.igdb.com`?

Answers
1. A new `lib/sources/podcasts.ts` adapter (+ its sample and tests), one line in `setup.ts`, and `"podcast"`
   in `MEDIA_TYPES`/`MEDIA_SOURCES` (+ the database `check` rules and the words in `display.ts`). The
   search page, the merge rules and the stores don't change: they only know `MediaResult`.
2. `Promise.all` fails as a whole as soon as ONE promise fails, so one broken source would hide every
   other source's results. Caught errors become a status line instead.
3. The secret is only sent to Twitch to get a temporary token. IGDB receives the client id and that token.
   If the token leaked, it would expire; the secret would not.

## Stage 4: Tracking + diary (2026-11-05)

### What we built
- **Progress tracking.** A log can now say how far you are: "Episode 7/24" (series, anime), "Chapter 120/?"
  (manga, total unknown), "Page 270/604 (44%)" or "45%" (books, your choice), "12.5 hours" (games). Movies
  have none. The log form has a progress box when it makes sense, and posters show it while you're in the
  middle of something.
- **Item page** `/media/<type>/<source>-<id>` (e.g. `/media/anime/anilist-16498`): cover, info, everyone's
  average rating, and **My log** with a progress tracker: a quick **+1 ep** button (saved right away), a
  status menu and a progress box. Reaching the last episode marks it "Watched" by itself. **Log it again**
  adds a new diary entry (older ones move under "Earlier").
- **Diary** `/u/<username>/diary`: every log as a timeline grouped by month, newest first. A log goes on the
  day you finished it ("Watched on"), or else the day you logged it.
- Everything works in demo mode (localStorage) AND with Supabase, through the same `MediaStore` interface.

### The plan we followed
1. Add `progress_unit` to the `Log` type and three store methods: `getMediaItem`, `getLogsForItem`, `updateLog`.
2. Write the progress math as pure functions (`lib/media/progress.ts`), plus `planLogUpdate` (the tracker's rules).
3. Write the diary grouping (`diary.ts`), the average rating (`display.ts`) and the item URLs (`links.ts`).
4. Implement the three methods in both stores, and add a NEW migration for the database.
5. Build the pages: progress box in the form, the tracker, the item page, the diary, links from posters.
6. Tests for every rule, then click through the whole thing in a real (headless) browser in demo mode.

### New concepts

**Storing a number AND its unit.** `progress = 45` means nothing alone: 45 pages? 45%? So a log stores two
columns, `progress` and `progress_unit`. We can't guess the unit from the type, because a book can be
tracked in pages (paper) or percent (e-reader). The total (24 episodes) is NOT copied onto the log: it
already lives on the item (`total_units`), and copying it would mean two places that can disagree.

**Migrations only move forward.** We changed the database by adding a new file
(`20261105020000_progress_units.sql`) instead of editing the Stage 2 one. A database that already ran Stage
2 never re-reads that file, so edits there would silently never happen. `alter table ... add column` adds
the unit, and `alter column progress type numeric using progress::numeric` changes whole numbers into
numbers with decimals (for 12.5 hours), telling Postgres how to convert the existing values.

**Checks across columns (and their limits).** A `check` can compare columns of the SAME row: "progress and
progress_unit are both set or both empty", "percent is at most 100", "only hours may have a decimal". But it
can't look at another table, so "episode 30 of a 24-episode anime" is checked by the app
(`validateProgress`), not the database. Knowing which layer can enforce which rule is a big part of design.

**Floats aren't exact.** Computers store decimals in binary, so `0.1 + 0.2` is `0.30000000000000004`. For
hours we round to one decimal (`Math.round(x * 10) / 10`) instead of refusing the value. For percentages we
use `Math.floor`, so 23/24 shows 95% and only 24/24 shows 100% (rounding would show "100%" too early).

**Derived data: compute it, don't store it.** "Everyone's average rating" is not a column: `averageRating()`
works it out from the logs each time. Nothing can go out of date. Each PERSON counts once with their most
recent rating (a `Map` from user id to rating), otherwise someone who logs a movie ten times would count ten
times. Later, with thousands of logs, the database could do this sum for us (see Decisions).

**Time zones and "which day is it?".** `created_at` is stored in UTC (`2026-11-05T02:30:00Z`). In Montreal
that's still Nov 4, 9:30 pm. `diaryDate()` turns it into YOUR calendar day with `localToday()`, so the diary
doesn't put evening logs on the next day. The tests use times at noon UTC, which is the same date in every
time zone from UTC-11 to UTC+11, so they pass on any computer.

**Grouping sorted data in one pass.** `groupDiaryByMonth` first sorts the entries newest first. Then a single
loop only has to ask "is this the same month as the previous one?": if yes, add it to the last group;
if not, start a new group. "YYYY-MM-DD" text sorts like dates, so `localeCompare` is enough.

**Two dynamic segments, and `notFound()`.** The folder `app/media/[type]/[id]/` catches `/media/anime/anilist-16498`
and Next.js gives both parts in `params`. `parseMediaItemParams` checks them (known type? known source?);
if the address is wrong, `notFound()` stops the page and shows `app/not-found.tsx`. The diary is a
**nested** route: `app/u/[username]/diary/` adds `/diary` after a profile.

**Custom hooks.** The profile and the diary both need "this username's profile and logs". Instead of copying
the loading code, it moved into `useProfileLogs()` (`components/useProfileLogs.ts`). A hook is just a
function whose name starts with `use` and that uses other hooks (`useState`, `useEffect`) inside.

**Resetting a component with `key`.** The tracker copies the saved log into its own state when it starts.
`<ProgressTracker key={current.id} ...>` tells React "a different id = a different tracker": when you log
something again, the old tracker is thrown away and a fresh one starts from the new log, instead of keeping
stale numbers.

**A text box for a number.** The progress box keeps its value as TEXT (`"7"`, or `""` for empty).
`parseProgressText()` turns `""` into `null` (no progress), `"12,5"` into 12.5, and junk into `NaN`, which
`validateProgress` refuses with a clear sentence. Storing a number directly would make "empty" impossible.

**Debugging with a theory (rule 9).** Clicking through the app showed a bug: a finished, rated game set to
"Want to play" became "Playing" instead of showing the "can't rate" error. Theory: the rule "Want to play +
progress = Playing" fired because the box was pre-filled with the saved 60.5 hours, before the rating check.
Evidence: two new tests reproducing it failed. Fix (root cause): the automatic status changes now only happen
when you CHANGE the progress. Both tests pass, and the same fix lets you set a 25/25 anime back to "Watching".

### New dependencies
None. (The browser click-through used the Chrome already on the machine, driven by a throwaway script that
is not part of the app.)

### Files and what each one does
- `lib/media/progress.ts` (new) units per type, `validateProgress`, `formatProgress` ("Episode 7/24"),
  `progressPercent`, the "+" button (`progressStep`, `stepLabel`, `incrementProgress`), `reachedEnd`,
  `parseProgressText`, `progressFieldLabel`. Tests: `progress.test.ts`.
- `lib/media/diary.ts` (new) `diaryDate`, `monthLabel`, `formatShortDate`, `groupDiaryByMonth`. Tests: `diary.test.ts`.
- `lib/media/links.ts` (new) `mediaItemPath` and `parseMediaItemParams` for `/media/[type]/[id]`. Tests: `links.test.ts`.
- `lib/media/types.ts` `PROGRESS_UNITS`, `progress_unit` on `Log`, optional progress on `NewLogInput`,
  `LogUpdateInput`, `MediaItemRef`, and the 3 new `MediaStore` methods.
- `lib/media/validation.ts` progress in `validateLogInput`, `planLogUpdate` (the tracker's rules), `mediaItemToResult`.
- `lib/media/display.ts` `logProgressLabel`, `averageRating`, `formatAverage`.
- `lib/media/mock.ts` and `lib/media/supabase.ts` `getMediaItem`, `getLogsForItem`, `updateLog` (both
  stores); the demo store reads pre-Stage-4 saves; Supabase converts `numeric` progress and explains a
  missing Stage 4 migration.
- `supabase/migrations/20261105020000_progress_units.sql` (new) `progress_unit`, `progress` as numeric, checks.
- `app/media/[type]/[id]/page.tsx` (new) checks the address, then shows `MediaItemView`.
- `app/u/[username]/diary/page.tsx` (new) shows `DiaryView`.
- `components/MediaItemView.tsx` (new) the item page. `components/ProgressTracker.tsx` (new) status, box, "+1".
  `components/ProgressField.tsx` (new) the progress box (used by the form and the tracker).
  `components/ProgressBar.tsx` (new) the bar. `components/DiaryView.tsx` (new) the diary.
  `components/useProfileLogs.ts` (new) the shared loading hook.
- `components/LogMediaForm.tsx` progress box, `cancelLabel`. `components/ProfileView.tsx` uses the hook,
  links to the diary. `components/PosterGrid.tsx` posters link to item pages and show progress.
  `components/MediaSearch.tsx` "Open its page" link after logging.
- Tests updated: `display.test.ts`, `validation.test.ts`, `mock.test.ts`.

Tests: 259 in 17 files (185 in 14 before this stage).

### Most important lines
```ts
const progressChanged = progress !== log.progress || progress_unit !== log.progress_unit;
```
In `planLogUpdate` (`lib/media/validation.ts`): the bug fix. Automatic status changes only happen when you
actually moved the progress, not just because the box still shows the saved number.

```ts
if (log.rating === null || latestByUser.has(log.user_id)) continue;
```
In `averageRating` (`lib/media/display.ts`): logs come newest first, so the FIRST rating we meet per person
is their latest, and every later one is skipped. One person, one vote.

```ts
return log.finished_at ?? localToday(new Date(log.created_at));
```
In `diaryDate` (`lib/media/diary.ts`): the date you gave wins; otherwise the day YOU logged it, in your time zone.

### Decisions
- **Item URLs use the source's id** (`anilist-16498`), not our database id: it's the same in demo mode and
  Supabase, so links can be shared, and it matches the database's unique rule.
- **The item page only shows items someone has logged** (the cached copy). Adapters can only search, not look
  up one id, and PLAN.md says not to copy catalogs. Others show "Not in Media Log yet" with a search link.
- **Progress past the total is refused** (episode 30 of 24): it catches typos. Downside: a cached total can
  be out of date (a running series gains episodes). Refreshing old cached items is for later (Stage 7 cache work).
- **Movies have no progress**, books use pages OR percent, games use hours with one decimal.
- **Auto status only in the tracker, only when the progress changes**: "Want to watch" + progress -> Watching,
  the last episode or 100% -> Watched (dated today). Dropped and Paused are never changed for you. The log form
  never changes the status you picked.
- **The log form asks for progress only while it's unfinished** (Watching/Paused/Dropped), and for games also
  when finished ("hours played"). A finished series doesn't need "24/24" typed in.
- **The average is computed in the browser from all logs of the item.** Fine for a hobby app; with thousands
  of logs per item we'd ask Postgres for it (a view or function using `avg()`).
- **`started_at` is still unused**: the diary uses the finished date or the logging day.
- **Logs saved in demo mode before Stage 4 still load** (no `progress_unit` = no unit).
- **With Supabase, the Stage 4 migration is required**: until it runs, saving says "Run the Stage 4
  migration". Not tested against a real Supabase project (no internet here); demo mode was clicked through
  in a headless browser.

### Practice exercise
Add a **"−1"** button to undo a wrong "+1". In `lib/media/progress.ts`, write
`decrementProgress(progress, unit)`: one step less (`progressStep(unit)`), never below 0, and for hours
rounded to one decimal like `incrementProgress`. Add tests in `progress.test.ts` (7 episodes -> 6, 0 -> 0,
5 pages -> 0, 12.5 hours -> 11.5). Then in `components/ProgressTracker.tsx`, add a button next to "+1 ep" that
calls `save({ status: log.status, progress: decrementProgress(...), progressUnit: savedUnit })`, shown only
when the progress is above 0. Run `npm test`, then try it on an item page. Bonus: what does `planLogUpdate` do
with the status when you go from 25/25 (Watched) down to 24? Is that what you'd want?

### Quiz
1. Why does `progress_unit` exist, when the media type already tells us "anime = episodes"?
2. Why can't the database itself refuse "episode 30" for a 24-episode anime?
3. Ana rated Dune 2, then 5 on a reread; Ben rated it 3. What does the item page show, and why not 3.3?

Answers
1. Books can be tracked in two ways (pages or percent), so the type alone isn't enough. Storing the unit also
   makes each log self-explaining: `45` + `percent` can't be misread as 45 pages.
2. A `check` constraint only sees the row being saved, and the total lives in another table (`media_items`).
   The app checks it in `validateProgress` (a database "trigger" could, but that's more advanced).
3. "★ 4.0 average from 2 ratings": each person counts once with their LATEST rating, so (5 + 3) / 2 = 4.
   3.3 would be (2 + 5 + 3) / 3, counting Ana twice.

## Stage 5: Social (2026-11-05)

### What we built
- **Follows.** A Follow button and "3 followers · 1 following" on every profile, and a "People to follow" list
  on the feed page.
- **Home feed** `/feed` (the **Feed** link in the nav bar): what the people you follow logged and reviewed,
  newest first ("Aiko watched Frieren ★★★★★", "Leo is watching Severance · Episode 6"), with their reviews.
- **Likes on reviews.** A ♡ under every review, in the feed and in a new **Reviews** section on item pages.
  You can't like your own review, or a log without a review.
- **Lists** `/u/<username>/lists` and `/lists/<id>`: make a public or private list ("Best anime for people
  who don't watch anime"), add items with the search box on the list page or "Add to list" on an item page,
  reorder by **dragging** a row or with the **↑ ↓** buttons (phones and keyboard), remove items, delete the list.
- **Demo people.** In demo mode the feed page has an "Add demo people" button: 3 made-up, clearly labeled
  people (`demo_aiko`, `demo_leo`, `demo_sam`) with logs, reviews, likes and a list, so you have someone to follow.
- Everything works in demo mode (localStorage) AND with Supabase, through the same `MediaStore` interface.

### The plan we followed
1. A new migration for the one missing table, `review_likes`, with RLS (`follows`, `lists`, `list_items` exist since Stage 2).
2. New `MediaStore` methods for follows, feed, likes and lists, plus `listProfiles` on `AuthService`.
3. The logic as pure functions: the feed (`feed.ts`), the ordering (`reorder.ts`), list checks (`lists.ts`).
4. Both stores implement the methods; the demo store mirrors every RLS rule.
5. The demo people seed (`lib/demo/seed.ts`), behind a labeled button.
6. The pages: feed, follow button, likes, reviews, lists, drag-to-reorder.
7. Tests for every rule, then a click-through in a headless browser (31 checks, all passing).

### New concepts

**Join tables (many-to-many).** One person follows many people, and is followed by many. That can't be one
column, so `follows` is a table of pairs: `(follower_id, following_id)`. `review_likes` (who liked which review)
and `list_items` (which item is in which list) are the same idea. Their primary key is the PAIR, which is how
the database says "you can follow someone only once".

**Policies that look at other tables.** In Stage 4 a `check` couldn't refuse "episode 30 of 24" because the
total is in another table. An RLS policy can: the insert policy on `review_likes` says
`exists (select 1 from logs where id = log_id and review_text is not null and user_id <> auth.uid())`, i.e.
"there is such a log, it has a review, and it isn't yours". The app checks the same rules with `likeProblem()`
to give a friendly sentence, because the database can only answer "no" (error 42501), not why.

**Building a feed ("fan-out on read").** The feed isn't stored anywhere. When you open it, we ask "logs whose
author is in the list of people I follow, newest first, 50 at most" (`.in("user_id", following)`). Big apps
like Twitter copy each post into every follower's feed when it's written ("fan-out on write") because millions
of people read at once. For us, one query with an index (`logs (user_id, created_at desc)`) is plenty.

**Avoiding one request per row (the "N+1 problem").** To show like counts for 50 feed entries, asking the
database 50 times would be slow. Instead we ask once for "all likes of these 50 logs" (`.in("log_id", ids)`)
and count them in JavaScript with `summarizeLikes()`. `attachSocial()` then glues logs, authors and likes
together, like a database "join" done by hand. Pure function, so it's tested with plain arrays.

**Optimistic updates.** When you press ♡, the count changes instantly, before the database answers. If saving
fails, we put the old count back and show the reason. The reorder does the same: the row moves at once, then
it saves. It makes the app feel fast, at the cost of a small "undo" path for errors.

**Idempotent actions.** "Idempotent" means doing it twice gives the same result as doing it once. Following
someone you already follow, or liking twice, changes nothing: the Supabase store ignores error `23505`
("already exists"), and the demo store checks first. The seed is idempotent too: the second click does nothing.
This matters because users double-click and networks retry.

**Storing an order.** A list's order lives in `list_items.position` (0, 1, 2...). To show the list we SORT by
position (`sortByPosition`), so gaps are fine: removing item 1 of 0-1-2 leaves 0-2, still in order. After a
reorder, `positionChanges()` gives the new positions 0, 1, 2... but returns only the rows that CHANGED, so
swapping two items saves two rows. It also refuses an order that doesn't match the list (changed in another tab).

**Immutable arrays.** `moveItem(items, from, to)` copies the array, then uses `splice` to cut one element out and
put it back elsewhere. It never changes the array it was given. React only redraws when it gets a NEW array
(it compares by reference), so changing the old one in place would show nothing.

**HTML drag and drop (built into browsers).** A row with `draggable` fires `dragstart` when you grab it (we
remember its index), `dragover` while something is dragged over another row (we must call `preventDefault()` to
say "you may drop here", browsers refuse drops by default), `drop` when you let go (we call `moveItem`), and
`dragend` at the end (we clear the highlight). Firefox needs `dataTransfer.setData(...)` or the drag never starts.

**Accessible alternatives.** Native drag doesn't work well on phones and can't be done with a keyboard, so each
row also has ↑ and ↓ buttons. They are real `<button>`s, so Tab + Enter works, and `aria-label="Move Arrival up"`
tells a screen reader what "↑" means. Follow and like are on/off buttons, so they say so with `aria-pressed`.

**Seed data, and a test that it doesn't drift.** The demo people's items are copied from the saved search
samples, so if you log Interstellar yourself, your log and Leo's point to the SAME cached item. A test converts
the samples with the real adapters and checks every demo item still matches: if someone edits a sample, the test
says which demo item to update. Every demo log also goes through `validateLogInput`, so it can't be something a
real user couldn't save.

### New dependencies
None. Drag-to-reorder uses the browser's own drag and drop. A library like dnd-kit would add touch dragging and
animations, but the ↑ ↓ buttons already cover phones and keyboards, so it wouldn't save real work. (The browser
click-through used the Playwright already installed on the machine, from a throwaway script outside the app.)

### Files and what each one does
- `supabase/migrations/20261105030000_review_likes.sql` (new) the `review_likes` table, its index and RLS policies.
- `lib/media/feed.ts` (new) `buildFeed`, `newestFirst`, `summarizeLikes`, `attachSocial`, `applyLikeChange`,
  `hasReview`, `likeProblem`, `feedAction` ("is reading", "rewatched"...), `displayName`. Tests: `feed.test.ts`.
- `lib/media/reorder.ts` (new) `moveItem`, `moveUp`, `moveDown`, `sortByPosition`, `nextPosition`, `sameIds`,
  `positionChanges`. Tests: `reorder.test.ts`.
- `lib/media/lists.ts` (new) `validateListInput`, `itemCountLabel`. Tests: `lists.test.ts`.
- `lib/media/types.ts` `PublicProfile`, `ReviewLike`, `SocialLog`, `MediaList`, `ListItem`, `ListWithItems`,
  `NewListInput`, and 15 new `MediaStore` methods.
- `lib/media/mock.ts` the demo store: follows, likes, lists and list items in localStorage, every RLS rule mirrored;
  loads saves from before Stage 5. Tests: `mock-social.test.ts` (new).
- `lib/media/supabase.ts` the same methods on the real tables (`author:profiles(...)` joins, one likes request per page).
- `lib/media/index.ts` gives the demo store a way to read profiles.
- `lib/auth/types.ts`, `mock.ts`, `supabase.ts` `listProfiles()` for "People to follow".
- `lib/demo/seed.ts` (new) the 3 demo people, their logs, likes, follows and list; `seedDemoPeople`, `hasDemoPeople`.
  Tests: `seed.test.ts`.
- `app/feed/page.tsx`, `app/u/[username]/lists/page.tsx`, `app/lists/[id]/page.tsx` (new) the three new pages.
- `components/FeedView.tsx` (new) the feed, People to follow, the demo box. `components/SocialLogCard.tsx` (new)
  one feed line or review. `components/LikeButton.tsx`, `FollowButton.tsx`, `Avatar.tsx` (new).
- `components/ListsView.tsx`, `NewListForm.tsx`, `ListView.tsx` (drag + ↑ ↓), `ListAddSearch.tsx`, `AddToList.tsx` (new).
- `components/ProfileView.tsx` follower counts, Follow button, Lists link. `components/MediaItemView.tsx` Reviews
  section and Add to list. `components/NavBar.tsx` Feed link.
- Tests updated: `display.test.ts` (Stage 5 error messages), `lib/auth/mock.test.ts` (`listProfiles`).

Tests: 321 in 22 files (259 in 17 before this stage).

### Most important lines
```sql
and exists (select 1 from public.logs l where l.id = log_id and l.review_text is not null and l.user_id <> (select auth.uid()))
```
In the `review_likes` insert policy: the database itself refuses likes on your own review or on a log without
one, even if someone skips our JavaScript and calls the API directly.

```ts
.filter((row) => oldPosition.get(row.media_item_id) !== row.position);
```
In `positionChanges` (`lib/media/reorder.ts`): after a reorder, only save the rows that actually moved.

```ts
if (dragIndex === null) return; // something else is dragged (a file, text...)
event.preventDefault();
```
In `ListView.tsx`: without `preventDefault()` in `dragover`, the browser never fires `drop`.

### Decisions
- **One store interface.** Follows, feed, likes and lists are new methods on `MediaStore` (not a second store),
  because they need the same logs and media items, and the pages already know `getMediaStore()`.
- **The feed is at `/feed`**, not on the home page: `/` stays the landing page for visitors. 50 newest entries,
  no "load more" yet.
- **Likes only on written reviews, never your own**, checked in three places: the button (hidden), the store
  (friendly error) and the database policy (the real lock).
- **Reorder saves one small update per moved row**, sent at the same time. It's not one atomic step: if the
  connection drops halfway, two items could share a position (still sorted, just tied). A Postgres function
  (`rpc`) could do it atomically; that's more advanced, for later. The ↑ ↓ buttons and dragging are disabled
  while saving, so two saves never overlap.
- **Removing an item leaves a gap** in positions; the next reorder closes it.
- **Demo people instead of "sign up a second account"**: one click gives a feed with reviews, likes and a list.
  Signing up a second account in the same browser still works too. They are labeled everywhere ("(demo)",
  `demo_` usernames, bio "not a real person"), only exist in demo mode, and you can log in as them
  (`aiko@demo.test`, `leo@demo.test`, `sam@demo.test`, password `demo-password`) to like YOUR reviews.
- **"People to follow" is just the 20 newest profiles.** Searching people is for later.
- **Follower counts load the id lists**: fine for a hobby app; with thousands of followers we'd ask Postgres for a count.
- **List notes**: the `note` column exists and is shown when set, but there's no way to type one yet (see the exercise).
- **Not tested against a real Supabase project** (no internet here). Demo mode was clicked through in a headless browser.

### Practice exercise
Add a **"Move to top"** button to lists. In `lib/media/reorder.ts`, write `moveToTop(items, index)` using
`moveItem`. Add tests in `reorder.test.ts`: `["a","b","c"]` with index 2 gives `["c","a","b"]`, index 0 changes
nothing, and the old array is unchanged. Then in `components/ListView.tsx`, add a `⤒` button before ↑ that calls
`saveOrder(moveToTop(items, index))`, with `aria-label={`Move ${item.media.title} to the top`}` and disabled for
the first row. Run `npm test`, then try it on one of your lists. Bonus: how many rows does `positionChanges`
save when you move the 5th of 5 items to the top? Why?

### Quiz
1. Why is the primary key of `follows` the pair `(follower_id, following_id)` instead of a separate `id`?
2. The like button is hidden on your own reviews. Why does the database policy still check it?
3. You remove the 2nd item of a 4-item list. What are the positions now, and why is the list still in the right order?

Answers
1. The pair IS what makes a follow unique: with it as the primary key, the database refuses following the same
   person twice. A separate `id` would allow duplicates unless we added a unique rule anyway.
2. The browser runs code the user controls: anyone can call the Supabase API directly with the public anon key.
   Hiding a button is for comfort; RLS is the real lock.
3. 0, 2, 3. We always sort by position, and 0 < 2 < 3 is still the right order. The gap closes at the next reorder.

## Stage 6: Stats + "bridge" recommendations (2026-11-05)

### What we built
- **Genres everywhere.** Every search result and cached item now carries its source's own genre words
  (`genres`), and one pure function turns them into **one small shared tag set** (21 tags: Space, Sci-Fi, Fantasy,
  Drama...). TMDB's "Science Fiction", AniList's "Sci-Fi" and Open Library's "Fiction, science fiction, general" all
  become `sci-fi`, so a movie and a manga can finally be compared. Item pages show the tags as chips.
- **Stats page** `/u/<username>/stats` (a **Stats** link on every profile): items per media type, a rating
  histogram with the average, top genres, and a **yearly recap** (entries, finished per type, average, top genre,
  busiest month, the 3 best-rated posters, a button per year).
- **Recommendations on the home page** (signed in): **Bridge picks** (anime, manga, games for people who mostly log
  movies, series and books) and **More for you** (any other media type). Each card says why ("Because you rated
  Interstellar 5★: shares Sci-Fi, Adventure, Drama") and has a **Log it** button.
- Works in demo mode and with Supabase, through the same `MediaStore` interface (one new method, `listMediaItems`).

### The plan we followed
1. Check the data: `MediaResult` and `media_items` had no genres. Add them to the 4 adapters, the samples and a new
   migration (old migrations stay untouched).
2. The shared tag map as a pure function (`lib/media/tags.ts`), tested first with the tricky spellings.
3. The candidate pool: database items (`listMediaItems`) + the saved samples as a catalog (`lib/sources/catalog.ts`).
4. Scoring, bridge rule and stats as pure functions (`recommend.ts`, `stats.ts`) with tests.
5. The pages: stats page with plain CSS bars, home picks, tags on item pages.
6. Lint, tests, build, then a click-through in a headless browser (17 checks, all passing). That click-through found a bad
   pick (see "Decisions"), which changed the scoring rule.

### New concepts

**Normalizing data from many sources.** Four APIs, four vocabularies, and one source (Open Library) types subjects as
free text. Instead of comparing raw words, we translate each one into a small set of tags we control: clean it
(`tagKey`: lowercase, no accents, no punctuation), cut it into pieces ("Sci-Fi & Fantasy" becomes two), then look each
piece up in an alias table. Unknown words just get no tag. It's the adapter idea from Stage 3, one level deeper.

**Store the raw data, translate when you read.** `media_items.genres` keeps the source's own words, not our tags.
If we improve the alias table later (say "Cyberpunk" should also be "Thriller"), every item already in the database
benefits right away. If we stored tags, we'd have to rewrite old rows. The cost: the translation runs on each read.
That's cheap here, a few hundred short arrays.

**Rule-based recommendations ("content-based filtering").** Big apps learn from millions of users ("people who
liked X also liked Y"). We don't have millions of users, so we compare the *content* instead: your favorites' tags against
each candidate's tags. Every pick comes from one rule you can read, so the app can always say *why*. That is the main
advantage over a black-box model, and it's what makes it testable with plain arrays.

**A scoring function.** Score = (shared tag points) × (rating − 3). Each shared tag is 1 point, a broad one (Drama,
Action, Adventure, Comedy) 0.5. A 5★ favorite multiplies by 2, a 4★ one by 1. Interstellar (5★) and Cowboy Bebop
share Sci-Fi (1) + Adventure (0.5) + Drama (0.5) = 2, times 2 = **4**. A candidate keeps its best score, and that
favorite becomes the reason shown. Ties are broken by fixed rules (more favorites matched, then A to Z), so the
order never changes randomly between reloads.

**Deterministic sorting with `||`.** `b.score - a.score || b.favoritesMatched - a.favoritesMatched || a.title.localeCompare(b.title)`:
a sort comparator returns a negative number, 0 or a positive number. `||` moves to the next rule only when the
previous one gives 0 (a tie), because 0 counts as "false" in JavaScript.

**Aggregations (counting and grouping).** Stats are "group by, then count", like SQL's `GROUP BY`, done in JavaScript
with a `Map` (tag to count) or an object with every media type set to 0 first (so "0 Games" still shows). The rule
"each item once" reuses `latestLogPerItem` from Stage 4. Pure functions again, so `stats.test.ts` checks them with
tiny made-up logs.

**Charts without a library.** A bar is a grey box with a violet box inside whose `width` is a percentage
(`style={{ width: "75%" }}`). `barPercent(count, max)` does the math; the biggest bar is 100%. Vertical bars
(the rating histogram) use `height` the same way inside a flex row with `items-end`. Inline `style` is right
here because the value is computed; Tailwind classes are for fixed values.

**Caching a computed value (memoization).** `sampleCatalog()` converts 64 sample entries with the real adapters,
then removes duplicates. It does that once and remembers the answer in a variable (`cached ??= ...`). `??=` means
"assign only if it's still null or undefined".

**Backfilling old rows.** Items cached before this stage have `genres = '{}'`. Users can't update `media_items`
(no RLS update policy, on purpose since Stage 2), so instead the app borrows genres from the samples when it reads an
old item (`fillGenres`). The demo store gives old saves `genres: []` when it loads them, like the database's default.

### New dependencies
None. The bars are plain HTML/CSS; a chart library (Recharts, Chart.js) would add 50+ KB of JavaScript for
5 simple bar charts. (The browser click-through used the Playwright already installed on the machine, from a throwaway
script outside the app.)

### Files and what each one does
- `supabase/migrations/20261105040000_media_genres.sql` (new) adds `media_items.genres text[]` (default `'{}'`) with a
  check: at most 12 words, no empty slots, no giant text.
- `lib/media/tags.ts` (new) the 21 shared tags, their labels, the alias table, `tagKey`, `genreToTags`,
  `genresToTags`, `sortTags`, `tagListLabel`. Tests: `tags.test.ts`.
- `lib/media/recommend.ts` (new) favorites, the candidate pool, `pairScore`, `scoreCandidate`, `recommend`,
  `reasonText`, the bridge rule (`bridgeAudience`), `spreadByType`, `bridgePicks`, `fillGenres`. Tests: `recommend.test.ts`.
- `lib/media/stats.ts` (new) `ratingDistribution`, `topTags`, `recapYears`, `yearlyRecap`, `barPercent`, `maxCount`.
  Tests: `stats.test.ts`.
- `lib/sources/catalog.ts` (new) `sampleCatalog()`: the saved samples through the real adapters, deduplicated.
  Tests: `catalog.test.ts`.
- `lib/sources/tmdb.ts` the genre number → name table (`TMDB_GENRES`, `tmdbGenreNames`).
- `lib/sources/anilist.ts` asks for `genres` and `tags`; `aniListGenres` keeps genres + strong, non-spoiler, known tags.
- `lib/sources/openlibrary.ts` asks for `subject`; `openLibraryGenres` keeps only subjects the tag map knows.
- `lib/sources/igdb.ts` asks for `genres.name` and `themes.name`, keeps both.
- `lib/sources/shared.ts` `cleanGenres` and `GENRES_MAX`. `lib/sources/merge.ts` a merged result keeps or borrows genres.
- `lib/sources/samples/*.json` AniList genres + tags, Open Library subjects, IGDB genres + themes (TMDB already had
  `genre_ids`). Written from memory, like the rest of the samples.
- `lib/media/types.ts` `genres` on `MediaResult` and `MediaItem`; `listMediaItems()` on `MediaStore`; `MEDIA_POOL_LIMIT`.
- `lib/media/validation.ts` genres are cached with the item. `lib/media/mock.ts` + `supabase.ts` read/write
  `genres`, implement `listMediaItems`; a friendly error when the Stage 6 migration is missing.
- `lib/demo/seed.ts` the demo items carry their genres (the seed test checks they still match the samples).
- `app/u/[username]/stats/page.tsx`, `components/StatsView.tsx` (new) the stats page.
- `components/HomePicks.tsx` (new) bridge picks + more for you; `app/page.tsx` shows it under the landing text.
- `components/MediaItemView.tsx` tag chips. `components/ProfileView.tsx` the Stats link.
- Tests updated for the new `genres` field: adapter tests, `merge`, `shared`, `mock`, `validation`, and fixtures in
  `diary`, `display`, `feed`, `mock-social`, `unified`.

Tests: 383 in 26 files (321 in 22 before this stage).

### Most important lines
```ts
const whole = tagsOfKey(tagKey(genre));
if (whole.length > 0) return sortTags(whole);
const found = genre.split(PIECE_SEPARATORS).flatMap((piece) => tagsOfKey(tagKey(piece)));
```
In `genreToTags` (`lib/media/tags.ts`): try the whole phrase first ("Detective and mystery stories" has its own meaning),
and only then cut it into pieces ("Fiction, science fiction, general" becomes 3 pieces, one of them known).

```ts
const points = sharedTags.reduce((sum, tag) => sum + tagPoints(tag), 0);
return { score: points * (favorite.rating - 3), sharedTags };
```
In `pairScore` (`lib/media/recommend.ts`): the whole recommendation engine is this one formula.

```ts
if (favorite.type === candidate.media.type) return { score: 0, sharedTags: [] };
```
The "cross-media" part: a movie never recommends another movie.

### Decisions
- **The bridge rule:** mainstream = movie, series, book; niche = anime, manga, game. You get bridge picks when
  you logged at least 3 different items and at least 75% (3 out of 4) of them are mainstream, every status counted.
  Picks come only from your mainstream 4★+ favorites, only niche candidates, and the best of each niche type comes
  first (`spreadByType`), so you see an anime, a manga and a game side by side. Below 3 items the page says how many
  you have; above 25% niche it says you don't need a bridge and shows "More for you" only.
- **Broad tags count half.** The first version gave every tag 1 point. Clicking through, an Interstellar fan got
  *Berserk* (a gory dark-fantasy manga) as a bridge pick instead of *Planetes* (a space manga), just because Berserk
  shares Adventure + Drama and won the tie. With broad tags at 0.5, one specific tag (Sci-Fi) beats two broad ones.
  A test now pins this case.
- **Candidate pool = our database + the saved samples.** No live catalog crawling (PLAN.md: never store whole
  catalogs, and there's no internet here). With Supabase, `listMediaItems` reads the 500 newest cached items. Items only
  in the samples have no item page yet, so their card has no link, but **Log it** works (that caches them).
- **"More for you" is spread over types too**, otherwise TMDB series (which TMDB tags "Sci-Fi & Fantasy") filled it.
- **TMDB lumps genres for series:** "Sci-Fi & Fantasy" gives both tags, so *The Witcher* series counts as Sci-Fi.
  We can't split what TMDB doesn't say. Movies have separate genres, and TMDB search has no "Space" (that would need
  its keywords endpoint, one more request per item), so Interstellar is Sci-Fi/Adventure/Drama, not Space.
- **Open Library and AniList tags are filtered before saving** (only words the tag map knows, AniList tags ranked
  60+/100 and not spoilers). A book can have 100+ subjects; the fixed genre lists (TMDB, AniList genres, IGDB) are kept whole.
- **Old items:** no update policy on `media_items` (unchanged since Stage 2), so items cached before Stage 6 stay
  `'{}'` in the database; the app borrows genres from the samples when it can. Live-searched items logged before
  Stage 6 (not in the samples) stay without tags: logging them again reuses the cached copy. A later stage could
  refresh them. Supabase isn't set up yet, so today that only affects demo saves.
- **Stats rules:** an item counts once (latest log) everywhere, except the recap's "entries" and "finished", which
  count diary entries (a rewatch is a new entry). "Want to" items don't count in top genres.
- **Not tested against a real Supabase project** (no internet). Demo mode was clicked through in a headless browser.

### Practice exercise
Add a **"Hours played"** line to the yearly recap. In `lib/media/stats.ts`, add `hoursPlayed: number` to `YearRecap`:
the sum of `progress` for that year's logs whose `progress_unit` is `"hour"`, counting each item once (use
`latestLogPerItem`). In `stats.test.ts`, add a test: a game finished with 22 hours and another at 31.5 hours give
53.5; a game logged twice counts only its latest log; a manga at chapter 14 adds nothing. Then show
"53.5 hours played" in `components/StatsView.tsx` when it's above 0. Bonus: why must `latestLogPerItem` get the
logs newest first?

### Quiz
1. Why do we save "Science Fiction" in `media_items.genres` instead of our own tag `sci-fi`?
2. You rated Interstellar 4★ and The Hobbit 5★. A candidate game shares Sci-Fi with Interstellar and Fantasy with
   The Hobbit. What's its score, and which reason is shown?
3. Someone logged 6 movies and 2 anime. Do they get bridge picks? And with 6 movies and 3 anime?

Answers
1. So the translation can improve later without touching the database: change the alias table and every old item
   gets the better tags the next time it's read. Our tags are a choice we might change; the source's words are facts.
2. Interstellar: 1 point × (4 − 3) = 1. The Hobbit: 1 point × (5 − 3) = 2. The best one wins: score 2, "Because you
   rated The Hobbit 5★: shares Fantasy". (favoritesMatched is 2, used only to break ties.)
3. 6 of 8 = 75%: yes, exactly on the line. 6 of 9 = 67%: no, they already log niche media, so only "More for you".
