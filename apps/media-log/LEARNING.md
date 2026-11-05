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
