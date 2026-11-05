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

## Stage 3: Streaks + calendar (2026-11-05)

### What we built
A `/streaks` page with your **check-in streak**, a **streak per habit** (current and best, missed
days in the last 30) and a **calendar heatmap** of the last 12 weeks: one for your mood and one per
habit, picked with a row of buttons. A **freeze** (❄) saves a streak when you miss a single day. The
home page's Streaks card now shows real numbers. There's also a `/breathe` page with a circle that
grows and shrinks for **4-7-8** and **box breathing**. Both pages open offline. All the counting is
in three pure, tested files: `lib/streaks.ts`, `lib/calendar.ts` and `lib/breathing.ts`.

### The streak rules (decided this stage)
1. A streak is the number of **done** days in a row.
2. **Today not done yet doesn't break anything**: you have until midnight (your phone's time).
3. **Freeze:** if you miss **one** day between two done days, the missed day is "frozen" and the
   streak goes on. The frozen day doesn't add to the count.
4. **One freeze per 7 days:** after a freeze on day F, the next one works from day F + 7. Two missed
   days in a row always end the streak.
5. Freezes are **automatic and never stored**: they are worked out from your history each time.
6. A habit with a daily goal (8 glasses) counts as done only when you reach the goal. For the
   check-in streak, a day counts if you saved anything that day (an answer or a habit).

Example (D = done, . = missed): `D D . D D D . D`. Day 3 is frozen. Day 7 is also a single miss,
but only 4 days after the first freeze, so it ends the streak. Best = 5, current = 1.

### New concepts

**Counting days with date keys, not timestamps.** A streak asks "was yesterday done?", so we need to
step from one day to the next. The trap is adding 24 hours: in Toronto, March 8 2026 lasts only 23
hours and November 1 lasts 25, so "+24 h" can skip a day or land on the same day twice.
Our days are date keys (`"2026-11-05"`) that were already made in your time zone when you checked
in. `addDays` and `daysBetween` (in `lib/checkin/date.ts`) do the maths in UTC, where every day is
exactly 24 h, so daylight saving can never break a streak. The time zone is used once (to make
the key) and never again.

**Walking through history (a loop with a "state").** `computeStreak` goes through every day from
your first done day to yesterday, oldest first, keeping a few variables as it goes: `run` (the
streak so far), `best`, and `lastFreeze` (when the last freeze was used). A done day adds 1. A missed
day either becomes frozen (rules 3 and 4) or sets `run` back to 0. Today is handled last, and
separately, because it isn't over. This "walk and keep a state" pattern is common in engineering
(think of a counter in a circuit).

**A `Set` for fast "is this in the list?".** `new Set(doneDates)` removes duplicates, and
`done.has(day)` answers instantly, even with years of history. With an array, `includes` would read
the whole list each time, for every day.

**Comparing date keys as text.** `"2026-11-05" < "2026-11-06"` works with plain string comparison,
because the year comes first and months and days always have 2 digits. That's why the format has to
be exactly `YYYY-MM-DD` (and why `isDateKey` is strict).

**Deriving instead of storing (freezes).** We could have saved "freeze used on Nov 3" in the
database. Instead, freezes are recomputed from your history every time. Nothing can get out of sync
(e.g. if an offline change for an old day syncs later, the freeze simply moves by itself), and no new table or
migration was needed. Rule of thumb: store the facts (what you did), compute the rest.

**Paging (Supabase's 1000-row limit).** Supabase sends at most 1000 rows per request. One year of 5
habits is already 1825 entries, so a single request would silently cut your history short and your
best streak would be wrong. `fetchAllPages` (in `lib/checkin/supabase.ts`) asks for rows 0 to 999,
then 1000 to 1999, and so on, until a page comes back with fewer rows. The query must be **sorted**
(`order("date")`, then `order("habit_id")`), otherwise the database could send the same row twice.

**Only ask for the columns you need (privacy again).** The mood calendar needs `date` and `mood`,
nothing else. `listCheckinDays` selects exactly those two columns, so a whole season of check-ins is
loaded without your journal or gratitude texts ever leaving the database.

**Heatmap as a table, and a tested "grid builder".** `buildCalendarGrid` is a pure function that
returns rows of 7 days (Monday first), the current week last, with each day's level (how dark its
square is), today, future days and frozen days. `components/streaks/CalendarHeatmap.tsx` only draws
it as an HTML `<table>`, which is the right element for a calendar: screen readers can move by row and
column. Each square also has hidden text ("Nov 5: Good", using Tailwind's `sr-only`) so it isn't
just colour, because some people can't tell the shades apart.

**Tailwind needs whole class names.** The square colours are written out in full
(`"bg-accent/30"`, `"bg-accent/50"`...) in a small lookup table. Building them at runtime
(`` `bg-accent/${n}` ``) wouldn't work: Tailwind only creates CSS for classes it finds whole in the
code. `/30` means "the accent colour at 30% opacity".

**Timing from the clock, not from counting ticks (breathing).** A timer that counts "1 more second"
every second drifts: browsers slow timers down when the phone is busy or the tab is hidden.
`breathingState(pattern, elapsedMs)` instead takes "milliseconds since Start" (from
`performance.now()`, a clock made for measuring that never jumps if the phone changes its time) and
works out the round, the phase and the countdown. The screen just reads it 10 times a second.

**CSS transitions, and `prefers-reduced-motion`.** We don't move the circle frame by frame in
JavaScript. When a phase starts, we set two CSS variables: the size to reach (`--breath-scale`) and how
long to take (`--breath-duration` = the phase length). The browser animates the rest
(`.breath-circle` in `app/globals.css`). Some people get dizzy or sick from motion on screen and turn
on "Reduce motion" in their phone settings. The `@media (prefers-reduced-motion: reduce)` rule then
keeps the circle still at a middle size, and the words ("Breathe in", "Hold") and the countdown guide
you instead. Only the phase name is in an `aria-live` region, so screen readers announce "Hold" but
don't read the countdown every second.

**Reused from Stage 2:** the `CheckinStore` interface with its three versions (demo, Supabase, and
the offline wrapper, which got `overlayCheckinDays` / `overlayEntryRange` so changes still waiting
to sync show up in your streaks), `todayKey()`, the "load in an effect, ignore it if cancelled"
pattern, and the service worker's `APP_SHELL` list (now with `/streaks` and `/breathe`).

**Why no new migration?** The new queries are "my rows between two days", and the Stage 2 tables
already have the right indexes for that: `unique (user_id, date)` on `checkins` and
`habit_entries_user_date`. RLS already limits them to your own rows. Nothing to change in the
database, so there's no new SQL file this stage.

### Dependencies
None added. A date library (date-fns, Luxon) could do `addDays`, but we only needed three small
functions (about 20 lines), and the heatmap is a plain table with Tailwind classes, not a chart library.

### Offline
In demo mode, streaks and calendars work fully offline (localStorage). In Supabase mode, the page
opens offline but says "Streaks and calendars will load when you're back online": the phone only
keeps the changes waiting to sync, not your whole history, and showing a half-empty history would
make your streaks look broken. The breathing page needs no data at all, so it always works offline.

### Files in this stage
- `lib/streaks.ts` (+ test): the streak rules: current/best streak, missed days, freezes, what counts as "done".
- `lib/calendar.ts` (+ test): builds the heatmap grid (weeks × 7 days) and each day's level (mood or habit).
- `lib/breathing.ts` (+ test): the two patterns, and which phase/countdown/circle size at any moment.
- `lib/checkin/date.ts` (+ test): `addDays`, `daysBetween`, `weekdayOf`, DST-proof.
- `lib/checkin/types.ts`: `CheckinDay` (date + mood) and two new store methods,
  `listCheckinDays(from, to)` and `listHabitEntries(from, to)`.
- `lib/checkin/validation.ts` (+ test): `validateDateRange`.
- `lib/checkin/mock.ts` (+ test): the two range methods for demo mode.
- `lib/checkin/supabase.ts` (+ test): the two range methods for Supabase, with `fetchAllPages` (paging).
- `lib/checkin/offline.ts` (+ test): the two range methods for the offline wrapper, and the overlays.
- `lib/checkin/index.ts`: exports the `CheckinDay` type.
- `app/streaks/page.tsx` + `components/streaks/StreaksView.tsx`: the streaks and calendar page.
- `components/streaks/CalendarHeatmap.tsx`: draws the heatmap and its colour key.
- `components/streaks/useStreakData.ts`: loads habits, check-in days and entries, computes the streaks.
- `components/streaks/StreaksCard.tsx` + `components/HomeView.tsx`: the home page's Streaks card.
- `app/breathe/page.tsx` + `components/BreatheView.tsx`: the breathing exercise.
- `app/globals.css`: the breathing circle animation and its reduced-motion version.
- `public/sw.js` + `lib/pwa/service-worker.test.ts`: `/streaks` and `/breathe` saved in advance, plus
  a test that every page in that list really exists (one typo would make the whole install fail).
- `README.md`, `LEARNING.md`: this.

### Exercise
Add a **"Done X of the last 30 days"** line under each habit on `/streaks`. First write a pure
function `doneInLastDays(doneDates, today, days)` in `lib/streaks.ts` that counts how many of the
`days` days ending today (today included) are in `doneDates`. Write its tests first in
`streaks.test.ts`: nothing done → 0; done today and yesterday → 2; a day 31 days ago doesn't count; a
duplicate date counts once; a date after today doesn't count. Run `npm test`, watch them fail, then
write the function (hint: `addDays(today, -(days - 1))` is the first day, and you can compare keys as
text). Then show it in `StreaksView.tsx` using `habitDoneDates(habit, data.entries)`.
Bonus question: should a frozen day count as "done" here? Why or why not?

## Stage 4: Friends + shared streaks (2026-11-05)

### What we built
A `/friends` page: add a friend by username, accept or decline requests, remove a friend. Then
**shared streaks**: pick a friend and one of your habits, they accept by picking one of *their*
habits, and the streak only grows on days you **both** did it. When your friend did it today and you
haven't, a gentle nudge says "Sam checked in for Stretch. Your turn!" on `/friends` and on the home
page's new Friends card (in the app only, no notifications). Data goes through a new `FriendsStore`
interface with two versions, like auth and check-ins. In demo mode, **Sam** is a pretend friend so you
can try it all in one browser.

### The shared streak rules (decided this stage)
1. A shared streak counts the days in a row you **both** completed the habit. Each of you uses your
   own local day (your phone's time zone).
2. A day only one of you did is a **missed day for the pair**.
3. **Freezes** work exactly like personal ones, on the pair's days: one missed day between two
   both-done days is frozen, one freeze per 7 days, two missed days in a row end it. The pair shares
   that freeze, and it's separate from your personal streak's freeze.
4. "Done" means the same as before: a habit with a goal counts when its owner reaches *their* goal.
5. **Nothing is stored**: the count, best and freezes are worked out from both people's days each
   time (see "Deriving the counts" below).

### New concepts

**Reusing a tested function instead of writing a new one (sets and intersection).** The hard part of
streaks (missed days, freezes, today, daylight saving) is already solved and tested in
`computeStreak`. A shared streak is just "a streak of the days you both did it". So
`lib/friends/shared-streaks.ts` only computes the *intersection* of your days and your friend's (the
days in both lists, using a `Set` like Stage 3) and passes it to `computeStreak`. That's a few lines
instead of a second copy of the rules that could drift apart from the first.

**Deriving the counts instead of storing them.** PLAN.md listed `current_count`, `best_count` and
`last_both_date` columns. We left them out. They would be a *cache*: a saved copy of something we can
compute. A copy can go stale: an old day synced late from offline, an unticked habit, a freeze that
moves. Worse, a count would need *both* people to update the same row, so either could write any
number. Computing it from the facts (who did what on which day) is always right. Same rule as Stage
3's freezes: store the facts, compute the rest.

**A friendship is a pair with a direction.** `friendships` has `user_a` (who asked), `user_b` (who
was asked) and `status` (pending/accepted). Declining or unfriending *deletes* the row, so you can
ask again later. To allow only one row per pair whatever the direction, the unique index is on
`(least(user_a, user_b), greatest(user_a, user_b))`: both orders give the same two values. In the
app, each row is turned into a "view" from *your* side (`toFriendshipView`): who the friend is and
whether the request is incoming or outgoing.

**Security definer functions (the friend's only window into your habits).** RLS works on whole rows,
and a `habit_entries` row contains the value (e.g. "25 minutes"), which a friend doesn't need. So
there is no friends rule on any of your tables. Instead, `shared_streak_days(streak, from, to)` is a
database function marked `security definer`: it runs with the rights of its owner (like a program
running as administrator), so it can read past RLS. It's safe because the function itself decides
what comes out: it only answers the two people in an active shared streak who are still friends, only
looks at those two habits, works out "done" inside (so neither the value nor the goal leaves the
database) and returns only `(user_id, day)`. `set search_path = ''` is the standard safety rule for
such functions: it uses only tables written in full (`public.habits`), so nobody can slip in a
look-alike table.

**Column-level permissions.** Accepting a request is an UPDATE. A normal policy would allow changing
*any* column of the row, including who it's between. `grant update (status) on friendships` allows
only the `status` column to be changed (`status, habit_b` on `shared_streaks`). Supabase gives new
tables broad permissions by default, so the migration first does `revoke all ... from anon,
authenticated`, then grants back only what the app uses.

**Letting the database check ownership (composite foreign keys, again).** A shared streak stores
`habit_a` and `habit_b`. `foreign key (habit_a, user_a) references habits (id, user_id)` means habit_a
must be a habit *of user_a* (same trick as `habit_entries` in Stage 2), so nobody can attach someone
else's habit. And `friendship_id ... on delete cascade` means unfriending removes the shared streaks
too, in the database, in one step. Inside the insert policy, a subquery checks the friendship is
accepted and between exactly these two people (`shared_streaks.user_a` is written in full there,
because a bare `user_a` inside the subquery would mean the friendship's column).

**Consent: an invite, not a link.** You can't see your friend's habits (they're owner-only), and
sharing your days is a choice. So a shared streak starts as *pending* with only your habit, and your
friend accepts by choosing which of *their* habits counts. The habit's name is copied into the row
(`habit_name`) so they know what you're inviting them to.

**A demo friend (a "fixture").** In testing, a *fixture* is data prepared in advance so you can try
something. Demo mode lives in one browser, so `lib/friends/demo-friend.ts` makes Sam, a real demo
account that accepts everything and gets a made-up history (the last 14 days, minus 3 and 8 days
ago) when you share a habit, today included, so you see the nudge at once. It's clearly labeled,
only exists in demo mode (`getDemoFriendTools()` returns null with Supabase), and you can log in as
Sam to see the other side. Two real demo accounts in the same browser also work.

**Waiting for several requests at once (`Promise.all`).** The friends page needs the days of every
active shared streak. `await` in a loop would ask one after the other. `Promise.all(list.map(...))`
starts them all at once and waits until all are back, in the same order as the list.

**In-app nudges vs push notifications.** Push notifications need a server that sends messages,
permission prompts and extra setup on iPhones. A nudge computed when you open the app (`nudge =
friend did it today && I haven't`) is a pure function, easy to test, and gentle on purpose: no
buzzing phone, just a note when you come back.

**Reused from earlier stages:** the interface + two implementations + `index.ts` (now
`getFriendsStore()`), `computeStreak` and `isHabitDone` (Stage 3), `fetchAllPages` for long lists
(Stage 3), `todayKey()` (Stage 2), `validateUsername` (Stage 1, usernames are how you find friends),
the "load in an effect, ignore if cancelled" pattern and the service worker's `APP_SHELL` (now with
`/friends`).

### Dependencies
None added. Everything is Supabase features we already use (tables, RLS, a SQL function called with
`supabase.rpc()`) and plain TypeScript.

### Offline
The `/friends` page shell is saved in advance, so it opens offline. In demo mode everything works
offline (localStorage). In Supabase mode, friends and shared streaks need the internet: the page says
"You're offline. Friends and shared streaks need the internet." with a Try again button, and the home
card stays quiet. Your check-in still works offline as before, and its changes count for shared
streaks once they sync.

### Files in this stage
- `supabase/migrations/20261105120000_friends_shared_streaks.sql`: `friendships`, `shared_streaks`,
  their RLS and column permissions, and the security-definer `shared_streak_days` function.
- `lib/friends/types.ts`: shapes of the data and the `FriendsStore` interface.
- `lib/friends/shared-streaks.ts` (+ test): the shared streak rules (intersection + `computeStreak`),
  the nudge, the hints, and the summary for the screens.
- `lib/friends/views.ts` (+ test): rows seen from your side, the "can I send this request?" check,
  cleaning a typed username. Shared by both stores.
- `lib/friends/mock.ts` (+ test): the demo store, with the same rules as the database.
- `lib/friends/demo-friend.ts`: demo friend Sam (account, made-up history, "checks in today").
- `lib/friends/supabase.ts` (+ test): the real store; friendly error messages.
- `lib/friends/index.ts`: `getFriendsStore()` and `getDemoFriendTools()` (demo mode only).
- `lib/friends/migration.test.ts`: checks the SQL never opens check-ins or habit entries to friends,
  and that the function returns only (who, which day).
- `app/friends/page.tsx` + `components/friends/FriendsView.tsx`: the friends page.
- `components/friends/SharedStreaksSection.tsx`: shared streaks, invites, "Start a shared streak".
- `components/friends/useFriendsData.ts`: loads everything and computes the shared streaks.
- `components/friends/useAction.ts`: runs a button's action, shows its error, reloads.
- `components/friends/FriendsCard.tsx` + `components/HomeView.tsx`: the home page's Friends card and nudge.
- `components/DemoBanner.tsx`: mentions friends.
- `public/sw.js` + `lib/pwa/service-worker.test.ts`: `/friends` saved in advance.
- `README.md`, `LEARNING.md`: this.

### Exercise
Show **"Best together: N days"** for each friend on the home Friends card, the best shared streak you
have with that friend across all your shared habits. First write a pure function
`bestWithEachFriend(summaries)` in `lib/friends/shared-streaks.ts` that returns a `Map` from the
friend's id to the highest `result.streak.best` among that friend's summaries. Write the tests first
in `shared-streaks.test.ts`: no summaries → empty map; two habits with the same friend (best 3 and 7)
→ 7; two friends → one entry each. Run `npm test`, watch them fail, write the function (a `for` loop
and `Math.max`), then use it in `FriendsCard.tsx`. Bonus question: we chose not to store
`best_count`. If a habit entry from 10 days ago is deleted, what happens to "best together"? Why is
that the right behaviour?
