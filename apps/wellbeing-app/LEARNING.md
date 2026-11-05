# LEARNING.md: Wellbeing

## Stage 1: Skeleton + accounts + PWA (2026-11-05)

### What we built
A Next.js app with a calm, mobile-first look (light and dark). You can sign up, pick a username, see an
empty "Today" home page and your profile, and log out. The login code is **copied** from the media log
(not imported from it, so each app stays independent) and trimmed. Like the media log, it runs in
"demo mode" (accounts saved in your browser) until you add Supabase keys. On top of that, the app is a
**PWA**: it has a manifest and icons so it can be installed, and a service worker so it opens offline.

### New concepts

**Progressive Web App (PWA).** A PWA is a normal website that a phone can install like an app: it gets
an icon on the home screen, opens full screen without the browser bar, and can work offline. It needs
three things: a *web app manifest* (name, icon, colours), a *service worker* (for offline), and HTTPS
(localhost is allowed for testing). No app store involved: you publish a new version by deploying the
website.

**The web app manifest.** A small JSON file that describes the app to the phone: its name, short name
(under the icon), which page opens first (`start_url`), and `display: "standalone"` (no browser bar).
In Next.js we write it as a function in `app/manifest.ts`; Next.js serves it at
`/manifest.webmanifest` and adds the `<link rel="manifest">` tag to every page for us.

**Icons, and "maskable" icons.** Chrome wants at least a 192px and a 512px PNG. Android also cuts
icons into its own shape (circle, rounded square...), so we add a *maskable* icon: a full square whose
important part stays in the middle 80% (the "safe zone"), so nothing gets cut off. iPhones read a
separate `apple-touch-icon` (Next.js creates that tag from `app/apple-icon.png`).

**Service worker.** A script (`public/sw.js`) the browser runs in the background, between our pages
and the internet. Every request the app makes goes through its `fetch` listener, where we choose to
answer from the network, from saved copies (the *Cache Storage*), or both. It has a life cycle:
`install` (runs once per new version: we save the app shell), `activate` (the new version takes over:
we delete old caches), then `fetch` (for every request).

**Caching strategies.** There's no single right way to cache, so `chooseStrategy()` in `sw.js` picks
one per request. *Cache-first* (`/_next/static/...` files): use the saved copy, because those file
names contain a hash of their content and never change. *Network-first* (pages, icons): try the
internet and save a fresh copy, and use the saved copy only when offline, so you never see an old page
when you're online. *Skip*: don't touch it at all (POST requests, Supabase, Next.js's page data).

**The app shell.** The "frame" of the app (pages, code, styles, icons) that is the same for every user.
We save it in advance (`APP_SHELL` in `sw.js`), and also scan each saved page's HTML for the
JavaScript/CSS files it needs (`extractAssetUrls()`), because a page without its code would open
offline as plain text. Personal data is never cached by the service worker: it lives in Supabase,
protected by RLS. Stage 2's check-in page just needs `"/checkin"` added to `APP_SHELL`; the
network-first rule for pages already covers it (a test checks this).

**Why the service worker is off in `npm run dev`.** In dev, files change every time you save. A
service worker could keep serving the old saved version and make you think your change didn't work.
So `components/ServiceWorkerRegister.tsx` only registers it in a production build, and in dev it
*removes* any service worker left over from a previous `npm start`. That's also why the app runs on
port 3001: a service worker controls a whole address (like `localhost:3000`), and we don't want it
catching the media log's pages.

**Testing a file in a sandbox (`node:vm`).** The browser downloads `sw.js` exactly as written (Next.js
doesn't touch it), so it's plain JavaScript and can't be imported like our TypeScript files. To test
it anyway, `lib/pwa/load-service-worker.ts` runs the real file inside a separate, empty JavaScript
world (Node's `vm` module) with a fake `self`, then calls its pure functions. We test the exact file
the browser runs, with no network involved.

**Pure functions vs "effects".** `sw.js` is split in two halves: pure decision functions
(`chooseStrategy`, `shouldCache`, `extractAssetUrls`, `cachesToDelete`: same input, same output) and
the event listeners that actually touch the network and cache. Only the first half has tests, and that's
where the decisions (and so the bugs) are. The same idea is behind `lib/home/greeting.ts`.

**Offline-safe profile (`lib/auth/profile-cache.ts`).** In Supabase mode the profile comes from the
internet. Offline, that request fails, and the app would wrongly think "no username" and ask you to
pick one again. So we save the last profile we loaded in localStorage and use it when offline. It is
only given back to the same account, and it's cleared when you log out.

**CSS variables + Tailwind `@theme`.** All colours live in one place, `app/globals.css`, as CSS
variables (`--page`, `--accent`...). A `prefers-color-scheme: dark` block swaps them when the phone is
in dark mode, and `@theme inline` turns them into Tailwind classes like `bg-page` or `text-accent`. To
change the look of the whole app, you change a few lines there.

**Mobile first.** We design for a phone screen first (one narrow column, `max-w-md`) and let it simply
centre on a computer. Buttons and inputs are at least 48px tall (`min-h-12`) for thumbs, inputs use
16px text so iPhones don't zoom in, and `env(safe-area-inset-*)` keeps content clear of the notch when
the app is installed.

**Reused from the media log (see its LEARNING.md, Stage 1, for the full explanations):** the App
Router, client components (`"use client"`), React context (`useAuth()`), the `AuthService` interface
with a Supabase and a demo implementation, Row Level Security, environment variables and
`.env.example`. One change in the SQL: profiles here are readable only by logged-in users (not the
whole internet), because this is a private app.

### Dependencies
No new ones compared to the media log, and no PWA library. The service worker is one file of about 250 lines
(half of them comments) that we wrote ourselves, so you can read every decision. Libraries like Serwist (Workbox) are worth it later
if we need things like background sync. What each dependency does:
- `next`, `react`, `react-dom`: the framework and the UI library.
- `@supabase/supabase-js`: talks to Supabase (login, database).
- `tailwindcss`, `@tailwindcss/postcss`: the styling classes and the build step that makes them.
- `typescript`, `@types/*`: type checking.
- `eslint`, `eslint-config-next`: finds common mistakes (`npm run lint`).
- `vitest`: runs the tests (`npm test`).

### Files in this stage
- `package.json`, `package-lock.json`: scripts and dependencies (same versions as media-log). Dev and
  start use port 3001.
- `next.config.ts`: headers so the browser never keeps an old `sw.js` in its normal cache.
- `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.mts`: tool settings.
- `.gitignore`, `.env.example`: what git ignores; the env variable names to fill in.
- `AGENTS.md`: notes Next.js writes for AI coding tools (same as in media-log).
- `app/layout.tsx`: wraps every page; phone viewport, theme colour, iPhone app tags.
- `app/manifest.ts`: the web app manifest.
- `app/globals.css`: the colour palette (light + dark) and base styles.
- `app/page.tsx` + `components/HomeView.tsx`: home. Welcome screen when logged out, "Today" when logged in.
- `app/login`, `app/signup`, `app/onboarding`: log in, sign up, pick a username.
- `app/profile/page.tsx` + `components/ProfileView.tsx`: your profile, install instructions, log out.
- `app/offline/page.tsx`: shown when offline and the page isn't saved.
- `app/not-found.tsx`: unknown addresses.
- `app/icon.svg`, `app/apple-icon.png`, `public/icons/*.png`: icons.
- `components/AuthProvider.tsx`: who is logged in + their profile (with the offline fallback).
- `components/AuthForm.tsx`, `UsernameForm.tsx`, `GoogleButton.tsx`, `DemoBanner.tsx`, `NavBar.tsx`,
  `Avatar.tsx`: copied from media-log and restyled.
- `components/InstallHint.tsx`: "put it on your home screen" steps, hidden once installed.
- `components/ServiceWorkerRegister.tsx`: registers `sw.js` (production only).
- `components/ui.ts`: shared Tailwind class lists (buttons, inputs, cards).
- `lib/auth/*`: the `AuthService` interface, demo and Supabase versions, validation, profile cache (+ tests).
- `lib/supabase/client.ts`: the one shared Supabase client.
- `lib/home/greeting.ts` (+ test): "Good morning/afternoon/evening" and which name to show.
- `lib/pwa/load-service-worker.ts`: runs `public/sw.js` in a sandbox for tests.
- `lib/pwa/service-worker.test.ts`: tests the caching rules.
- `lib/pwa/manifest.test.ts`: checks the manifest, and that each icon exists with the right size.
- `public/sw.js`: the service worker.
- `scripts/make-icons.mjs`: draws the PNG icons with no library (`npm run icons`).
- `supabase/migrations/20261105100000_profiles.sql`: the profiles table with RLS.
- `../../.github/workflows/wellbeing-app.yml`: runs lint, tests and build on GitHub for this app.

### Exercise
Open `public/sw.js` and find `chooseStrategy`. Add a rule so that requests for `/icons/...` use
`"cache-first"` instead of `"network-first"` (icons rarely change). First change the test in
`lib/pwa/service-worker.test.ts` ("refreshes icons and the manifest...") so it expects the new
behaviour for icons, run `npm test` and watch it fail, then change `sw.js` until it passes. Bonus
question: why might cache-first be a bad idea for icons if you redesign the logo later? (Hint: look at
`CACHE_VERSION`.)

## Stage 2: The daily check-in (2026-11-05)

### What we built
The check-in itself, at `/checkin`: mood (plus optional words) → screen time → three gratitudes → a
short journal → your habits, one screen at a time, with big buttons and a bar of buttons at the
bottom where your thumb is. Every step has **Skip**, and every answer is saved the moment you give
it, so closing the app halfway keeps what you did. A `/habits` page lets you add habits (yes/no, a
count, or minutes, with an optional daily goal) and archive them. The home page shows today's
progress. Data goes through one `CheckinStore` interface with two versions, like auth: Supabase
(real database) and demo (localStorage). Both pages open offline, and saving offline works too.

### New concepts

**Which day is "today"? (date keys and time zones).** A check-in belongs to a day, written as a
"date key" like `"2026-11-05"`. The catch: the day depends on where you are. At 10 pm in Toronto it's
already 3 am tomorrow in UTC, the time zone that servers and `new Date().toISOString()` use, so an
evening check-in would land on the wrong day. `lib/checkin/date.ts` asks the browser for the date on
the wall clock in *its* time zone (`Intl.DateTimeFormat` with `timeZone`, then `formatToParts` to get
year, month and day separately). It's a pure function, so the tests can check tricky moments
(midnight, the two daylight-saving changes) at exact instants, on any computer.

**Partial saves ("patches").** Instead of saving the whole check-in at the end, each step sends only
what changed: `{ mood: 4 }`, later `{ journal_text: "..." }`. We call that a *patch*. One rule makes it
work: a missing field (`undefined`) means "don't touch it", and `null` means "clear it". `merge.ts`
has the three pure functions around this: `applyPatch` (the check-in after a patch), `mergePatches`
(two waiting patches become one, the newer value wins) and `diffCheckin` (what changed since the last
save). Watch out for `{ ...a, ...b }`: it copies `undefined` values too, which would wipe answers, so
`definedOnly()` removes them first.

**Upsert, and "unique per user per day".** The database has `unique (user_id, date)` on `checkins`,
so there can only be one row per person per day. Saving uses an *upsert* ("update, or insert if it
doesn't exist yet") with `onConflict: "user_id,date"`. Supabase only updates the columns we send, so
a patch with just the mood never erases the journal. The demo store does the same thing by hand.

**Save as you go (debounce, ordering, saving on exit).** `components/checkin/useCheckinSaver.ts`
saves taps right away, and typing 0.8 s after you stop (a *debounce*: each key press restarts a
timer, so we don't send one request per letter). Saves wait for each other in a chain of promises,
so they always arrive in order. It also saves when the page is hidden (`visibilitychange`, e.g. you
lock your phone), when it closes (`pagehide`) and when you leave for another page (the effect's
cleanup). It keeps two copies of the answers in **refs** (`useRef`): what's on screen and what the
store has. A ref is a box React doesn't watch: changing it doesn't redraw the screen, and async code
always reads the latest value from it, which a normal state variable can't promise.

**A store that wraps a store (offline queue).** In Supabase mode, saving offline would just fail.
`lib/checkin/offline.ts` takes the Supabase store and returns a new store with the same methods (this
pattern is called a *decorator*). When a save can't reach the internet, it keeps the patch in
localStorage, merged with any earlier waiting patch for that day, and the screen says "Saved on this
device, will sync when online". On the next page load, or the browser's `online` event, it sends them.
How do we know it's a network problem and not a "no" from the database? supabase-js doesn't throw:
it returns `status: 0` when the request never got an answer, and `toStoreError()` turns that into an
`OfflineError`. Only those get queued; real refusals are shown to you. `navigator.onLine === false`
skips the network entirely (supabase-js would otherwise retry for about 7 seconds).
Demo mode doesn't need any of this: localStorage is always there.

**Row Level Security protects rows, not columns (journal privacy).** An RLS policy says which *rows*
someone may read. If Stage 4 added "friends can read my check-ins", a friend could read every column
of those rows, `journal_text` included. So we decided now: the `checkins` table stays owner-only
forever, and what friends will need for shared streaks (did you do habit X on day D?) lives in
`habit_entries`, a separate table with no text in it. Splitting data by *who may see it* is simpler
and safer than trying to hide one column. `lib/checkin/migration.test.ts` reads the SQL file and fails
if a check-in policy ever stops being "the row is mine".

**Composite foreign key and partial unique index.** Two database rules that save us code.
`foreign key (habit_id, user_id) references habits (id, user_id)` means an entry must point to a
habit *of the same person*, so you can't log entries on someone else's habit even by tampering with
a request. `create unique index ... on habits (user_id, lower(btrim(name))) where not is_archived` means
"no two *active* habits with the same name": the `where` part makes it a *partial* index, so an
archived "Read" doesn't block a new "Read".

**Archive instead of delete.** Archiving sets `is_archived = true`: the habit disappears from the
check-in, but its history stays (Stage 3's streaks and calendar need it). That's why there is no
delete rule for habits in the SQL. A "no row" in `habit_entries` means "not done", so unticking a
habit (or setting it to 0) deletes its entry for that day.

**Accessible buttons.** Picked buttons use `aria-pressed="true"` (mood, words, habit types), the
habit row uses `role="checkbox"` + `aria-checked`, and the "Saved" note uses `aria-live` so screen
readers announce it. Tailwind can style these directly: `aria-pressed:bg-accent` only applies when
the button is pressed, so the look always matches what screen readers hear.

**Reused from Stage 1:** the interface + two implementations + `index.ts` that picks one (now
`getCheckinStore()`, same rule as `getAuthService()`), the service worker (we only added `/checkin`
and `/habits` to `APP_SHELL`), `useSyncExternalStore` (now for `navigator.onLine` in `useOnline.ts`).

### Dependencies
None added. Dates use the browser's built-in `Intl`, and the offline queue is about 300 lines we
wrote (most of them comments). A library like Workbox's "background sync" can send queued requests
even after the page is closed, but it works on raw HTTP requests, which doesn't fit our "merge the
patches first" idea, and the browser feature it relies on (Background Sync) isn't in Safari.

### Files in this stage
- `supabase/migrations/20261105110000_checkins_habits.sql`: the `habits`, `checkins` and
  `habit_entries` tables, owner-only RLS, and the privacy note for Stage 4.
- `lib/checkin/types.ts`: shapes of the data and the `CheckinStore` interface; `OfflineError`.
- `lib/checkin/date.ts` (+ test): today's date key in the browser's time zone (Toronto by default).
- `lib/checkin/validation.ts` (+ test): cleaning and limits for answers, habits and habit values.
- `lib/checkin/merge.ts` (+ test): partial saves (apply, merge, diff).
- `lib/checkin/steps.ts` (+ test): the step list, moods and mood words, screen time helpers.
- `lib/checkin/mock.ts` (+ test): the demo store in localStorage, with the same rules as the database.
- `lib/checkin/supabase.ts` (+ test): the real store; turns network failures into `OfflineError`.
- `lib/checkin/offline.ts` (+ test): the "will sync when online" wrapper for the Supabase store.
- `lib/checkin/index.ts`: `getCheckinStore()` picks demo or Supabase (+ offline wrapper).
- `lib/checkin/migration.test.ts`: checks the SQL keeps check-ins owner-only and matches the limits.
- `lib/auth/mock.ts`: the in-memory storage used in tests got a `removeItem` (the queue needs it).
- `app/checkin/page.tsx` + `components/checkin/CheckinView.tsx`: loads today, then shows the flow.
- `components/checkin/CheckinFlow.tsx`: step order, progress bars, Skip/Next/Back, the done screen.
- `components/checkin/CheckinSteps.tsx`: the 5 screens (mood, screen time, gratitude, journal, habits).
- `components/checkin/useCheckinSaver.ts`: "save as you go".
- `app/habits/page.tsx` + `components/HabitsView.tsx`: add, archive, restore habits.
- `components/TodayCheckinCard.tsx`: the home page card (Start / Continue, "3 of 5 parts answered").
- `components/HomeView.tsx`: uses that card instead of the "coming soon" one.
- `components/useRequireAccount.ts`: sends you to /login or /onboarding when needed.
- `components/useOnline.ts`: is the device online?
- `components/DemoBanner.tsx`: now mentions check-ins too.
- `public/sw.js` + `lib/pwa/service-worker.test.ts`: `/checkin` and `/habits` saved in advance.
- `README.md`, `LEARNING.md`: this.

### Exercise
Right now the check-in always reopens on step 1, even if you already answered the first three. Make
it reopen on the first step you haven't answered. First write a pure function
`firstUnansweredStep(fields, habitsDone)` in `lib/checkin/steps.ts` that returns a step index (0 to 4,
or 5 if everything is answered). Write its tests in `steps.test.ts` first (nothing answered → 0; mood
and screen time answered → 2; everything → 5), run `npm test` and watch them fail, then write the
function. Finally use it in `CheckinFlow.tsx` as the starting value of `stepIndex`. Bonus question:
should a fully answered check-in open on the "done" screen or on step 1? Why?
