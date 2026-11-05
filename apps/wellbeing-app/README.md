# Wellbeing

A calm, minimal daily check-in (about 5 minutes): mood, screen time, gratitude, a short journal and
habits, with per-habit streaks and shared streaks with a friend. It's a PWA: you can install it on your
phone from the browser, and it opens with no connection.

**Status:** Stage 4 of 5 done (accounts + PWA, the daily check-in, streaks + calendar +
breathing, then friends + shared streaks). Insights and shipping come in Stage 5. See [PLAN.md](PLAN.md) for all stages and [LEARNING.md](LEARNING.md) for what each
stage taught.

## What works now
- Sign up / log in with email and password (Google login once Supabase is set up).
- Pick a username, see your profile (`/profile`), log out.
- **The daily check-in** (`/checkin`): mood (+ optional words) → screen time → 3 gratitudes → a short
  journal → your habits, one step at a time with big buttons. Every step can be skipped, and every
  answer is saved as you go, so stopping halfway keeps what you did. One check-in per day; opening it
  again later the same day lets you change your answers.
- **Habits** (`/habits`): add a yes/no, count or minutes habit (with an optional daily goal and
  emoji), archive one (hidden from the check-in, history kept), restore it.
- The home page shows today's progress ("3 of 5 parts answered") and Start / Continue, and your
  streaks.
- **Streaks + calendar** (`/streaks`): your check-in streak and one streak per habit (current, best,
  missed days in the last 30), plus a calendar heatmap of the last 12 weeks for your mood or for one
  habit at a time.
- **Breathing** (`/breathe`): a circle that grows and shrinks for 4-7-8 (4 rounds) or box breathing
  (6 rounds), with a countdown. With "Reduce motion" turned on in your phone's settings, the circle
  stays still and the words and countdown guide you.
- **Friends** (`/friends`): add a friend by username, accept or decline requests, remove a friend.
- **Shared streaks**: pick a friend and one of your habits; they accept by picking one of theirs (or
  making a new yes/no habit with the same name). The streak only goes up on days you **both** did it.
- **The nudge**: when your friend did a shared habit today and you haven't yet, the home page and
  `/friends` say "Sam checked in for Stretch. Your turn!" (in the app only, no notifications).
- "Today" is the date on your phone's clock, in its time zone (America/Toronto if it can't tell).
- Install it on a phone or computer (web app manifest + icons).
- Offline: the check-in, habits, streaks, breathing and friends pages open without a connection (the service worker saves them in
  advance). In demo mode the check-in fully works offline. In Supabase mode, answers saved offline
  are kept on the device and sent when you're back online ("Saved on this device, will sync").
  Streaks need your history, so in Supabase mode they load once you're back online (in demo mode
  they work offline too). Friends need the internet in Supabase mode (the page says so).

## How streaks work
- A streak is the number of days in a row you did it. **Today doesn't count against you until
  midnight** (your phone's time zone, America/Toronto by default).
- **Freeze (❄):** miss **one** day between two done days and the streak goes on. The frozen day
  doesn't add to the count. You get **one freeze per 7 days**. Two missed days in a row end the
  streak. Freezes are automatic.
- A habit with a daily goal (e.g. 8 glasses) counts as done when you reach the goal. For the check-in
  streak, a day counts if you saved anything that day.
- All of this is in `lib/streaks.ts`, with tests for missed days, freezes, daylight-saving changes and
  late-night check-ins.

## How shared streaks work
- A shared streak counts the days in a row you **both** completed the habit (each on your own local
  day). It uses the exact same rules as above, on the days you both did it.
- A day only one of you did is a missed day for the pair. **Freeze:** the pair has one freeze per 7
  days (separate from your personal ones); one such day between two both-done days is covered.
- Counts are never stored: they're worked out from both people's days each time
  (`lib/friends/shared-streaks.ts`).

## Run it

```bash
cd apps/wellbeing-app
npm install
npm run dev        # http://localhost:3001
```

The app uses port **3001** (not 3000) on purpose: a service worker controls a whole address, so if
wellbeing-app and media-log both used `localhost:3000`, this app's service worker would also catch the
media log's pages.

### Demo mode (no setup)
With no `.env.local`, the app runs in **demo mode**: accounts, profiles, habits and check-ins are saved
only in your browser (localStorage). A strip at the top says so. Good for trying things; nothing goes
online.

### Real accounts (Supabase)
1. Create a free project at supabase.com.
2. SQL Editor > New query > paste `supabase/migrations/20261105100000_profiles.sql` > Run. Then a new
   query with `supabase/migrations/20261105110000_checkins_habits.sql` > Run (Stage 2: habits,
   checkins, habit_entries). Then `supabase/migrations/20261105120000_friends_shared_streaks.sql`
   (Stage 4: friendships, shared_streaks and the `shared_streak_days` function). Table Editor should
   show all 6 tables with "RLS enabled". (Stage 3 needs no new SQL.)
3. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings > API). Never the `service_role` key.
4. Authentication > URL Configuration: Site URL `http://localhost:3001`, and add
   `http://localhost:3001/onboarding` to Redirect URLs.
5. Restart `npm run dev`. The demo strip disappears.

Google login: create an OAuth client in Google Cloud Console with redirect URI
`https://<your-project>.supabase.co/auth/v1/callback`, then enable Google in Supabase >
Authentication > Sign In / Providers and paste its ID and secret.

## Test the check-in by hand (demo mode is fine)
1. `npm run dev`, open http://localhost:3001, sign up, pick a username.
2. Home > "Manage habits": add "Stretch" (Yes / no) and "Water" (A count, goal 8). Add a third and
   archive it: it moves to "Archived".
3. Home > "Start check-in". Tap a mood and a word, tap **Skip** on screen time, type one gratitude,
   type half a sentence in the journal, then tap the app name to leave.
4. The home card says "3 of 5 parts answered". Open the check-in again: your answers are filled in.
   Tap the 5th bar at the top, tick Stretch, tap + on Water three times, **Finish**.
5. DevTools > Application > Local storage > `wellbeing-app:mock-checkins`: one check-in for today
   with exactly what you entered (skipped parts are empty), and two habit entries.
6. Offline (needs `npm run build && npm start`, see below): DevTools > Network > Offline, open
   `/checkin`, change your mood: it still saves.

## Test streaks, the calendar and breathing by hand (demo mode is fine)
Streaks need several days of history. The quickest way to get some is to type it into the demo data:
1. `npm run dev`, sign up, add a habit "Stretch" (Yes / no), do today's check-in and tick Stretch.
2. Open `/streaks`: check-in streak 1 "Done today.", Stretch 1, today's square has a dark outline.
3. DevTools > Application > Local storage > `wellbeing-app:mock-checkins`. In `habitEntries`, copy
   your Stretch entry twice and change the copies' `date` to **2 and 3 days ago** (`YYYY-MM-DD`).
   Reload `/streaks`: Stretch shows 3 days, and yesterday shows ❄ in the Stretch calendar (a freeze
   covered it). The check-in streak shows 3 too.
4. Change the copy from 2 days ago to **4 days ago** and reload: now 2 days in a row are missed, so
   Stretch is back to 1, best 2 (4 and 3 days ago), and "Missed 2 days in the last 30".
5. Tap **Mood** above the calendar: days with a mood are shaded (darker = better mood). Hover or
   long-press a square to see "Nov 5: Good".
6. `/breathe`: pick 4-7-8, **Start**. "Breathe in" for 4 s while the circle grows, "Hold" for 7 s,
   "Breathe out" for 8 s while it shrinks; "Round 1 of 4 · 1:16 left" counts down. **Stop** resets it.
7. Reduced motion: DevTools > ⋮ > More tools > Rendering > "Emulate CSS media feature
   prefers-reduced-motion: reduce". Start again: the circle stays still, the words still change.

## Test friends and shared streaks by hand (demo mode is fine)
Demo mode lives in one browser, so there's a pretend friend, **Sam** (a demo account that accepts
everything and already did shared habits on most of the last 2 weeks, today included).
1. `npm run dev`, sign up, add a habit "Stretch" (Yes / no). Don't tick it today.
2. Open `/friends` (home > "Friends and shared streaks"). Tap **Add Sam, a demo friend**: Sam is in
   "Your friends".
3. Under "Start a shared streak", pick Sam and Stretch, tap **Invite**. It's active at once, and a
   "Your turn" box says "Sam (demo) checked in for Stretch. Your turn!". The home page shows it too.
4. Do your check-in and tick Stretch. Back on `/friends`: "You both did it today", 1 day together, and
   the nudge is gone.
5. Add your Stretch entry for 1 and 2 days ago (DevTools > Local storage >
   `wellbeing-app:mock-checkins`, copy your entry and change `date`, like in the streaks test above)
   and reload: 3 days together. Add copies for **3 and 4** days ago too: 4 days together, and not 5,
   because Sam missed 3 days ago. A freeze covered that day for the pair, so the streak kept going.
6. On a later day, tap **Sam checks in today** to make the nudge appear again.
7. Two real accounts: log out, sign up a second account, add the first one by username. Log back in
   as the first: the request is under "Friend requests". Accept, invite, log in as the other, pick a
   habit, Accept. To see Sam's side, log in as `sam@demo.local` / `demo-friend`.
8. Remove a friend: their shared streaks disappear too.

## Test the PWA by hand
The service worker only runs in a production build (in `npm run dev` it is switched off on purpose,
see LEARNING.md).

```bash
npm run build
npm start          # http://localhost:3001
```

1. Open http://localhost:3001 in Chrome. Sign up, pick a username.
2. DevTools (F12) > Application > Manifest: no errors, icons shown. Service workers: `sw.js` is
   "activated and is running". Cache storage: `wellbeing-pages-v1` (with `/checkin`, `/habits`,
   `/streaks`, `/breathe` and `/friends` in it) and `wellbeing-static-v1`.
3. DevTools > Network > set "No throttling" to **Offline**. Reload: the home page still opens with
   your name. Go to `/checkin`, `/profile`, `/streaks` and `/breathe`: they work. Go to `/abc`:
   "You're offline".
4. Install: the install icon in the address bar (computer), or on a phone see the "Put it on your home
   screen" card on `/profile`. A phone needs HTTPS, so test phone install on the Vercel deploy
   (localhost is the only address allowed without HTTPS).

To start fresh: DevTools > Application > Storage > "Clear site data".

## Scripts
| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3001 (no service worker) |
| `npm run build` / `npm start` | Production build / run it (service worker on) |
| `npm run lint` | ESLint |
| `npm test` | Vitest: auth, profile cache, service worker rules, manifest and icons, check-in logic (dates, validation, merging, demo store, offline queue, SQL privacy rules), streaks, calendar grid, breathing timing, friends and shared streaks (rules, demo store, demo friend, SQL privacy rules) |
| `npm run icons` | Redraws the PNG icons (`scripts/make-icons.mjs`) |

## Folder map
- `app/`: pages (`/`, `/checkin`, `/habits`, `/streaks`, `/breathe`, `/friends`, `/login`, `/signup`,
  `/onboarding`, `/profile`, `/offline`), the layout, the manifest (`manifest.ts`), icons and global
  styles.
- `components/`: React components (forms, nav bar, home, profile, habits, service worker
  registration, breathing). `components/checkin/`: the check-in flow, its 5 screens and the "save as
  you go" hook. `components/streaks/`: the streaks page, the heatmap and the home page's card.
  `components/friends/`: the friends page, shared streaks, and the home page's Friends card (the nudge).
- `lib/auth/`: accounts. One `AuthService` interface, a Supabase version and a demo (localStorage)
  version, chosen by whether the Supabase keys are set. Copied from `apps/media-log`.
- `lib/checkin/`: check-ins and habits. One `CheckinStore` interface, a Supabase version and a demo
  (localStorage) version, plus the offline queue that wraps the Supabase one. Also the pure logic:
  today's date key, validation, merging partial saves.
- `lib/streaks.ts`, `lib/calendar.ts`, `lib/breathing.ts`: the pure logic of Stage 3 (streak rules,
  heatmap grid, breathing phases), each with its test file.
- `lib/friends/`: friends and shared streaks. One `FriendsStore` interface, a Supabase version and a
  demo version (plus demo friend Sam), and the pure shared-streak rules (`shared-streaks.ts`).
- `lib/pwa/`: tests for the service worker and the manifest.
- `public/sw.js`: the service worker. `public/icons/`: app icons.
- `supabase/migrations/`: SQL to create the tables, with Row Level Security.

## Privacy
Your check-ins (mood, screen time, gratitude and journal) are readable only by you. This is enforced
by the database's Row Level Security, not just the app: the `checkins` table has owner-only rules and
will never get a "friends can read" rule. The streaks page and calendar only ever load the date and
mood of your check-ins, never the journal or gratitude texts.

**What friends see:** your username and display name, and, only for a habit you chose to share with
them, which days you completed it. Not the amount (e.g. minutes), not your goal, nothing from your
check-in. Friends never get a "read" rule on your tables: one database function,
`shared_streak_days`, answers only "who did the shared habit on which day", and only to the two
people in that shared streak. See the notes at the top of both
`supabase/migrations/20261105110000_checkins_habits.sql` and
`supabase/migrations/20261105120000_friends_shared_streaks.sql`.

The service worker never stores personal data: only page shells, code and icons, which are the same
for everyone. In Supabase mode, two things are kept in this browser's localStorage: answers saved
while offline (deleted as soon as they reach Supabase) and your habit list (names only, so the
check-in works offline).
