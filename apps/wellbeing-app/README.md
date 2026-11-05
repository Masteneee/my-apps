# Wellbeing

A calm, minimal daily check-in (about 5 minutes): mood, screen time, gratitude, a short journal and
habits, with per-habit streaks and shared streaks with a friend. It's a PWA: you can install it on your
phone from the browser, and it opens with no connection.

**Status:** Stage 2 of 5 done (accounts + PWA, then the daily check-in). Streaks and the calendar
come in Stage 3. See [PLAN.md](PLAN.md) for all stages and [LEARNING.md](LEARNING.md) for what each
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
- The home page shows today's progress ("3 of 5 parts answered") and Start / Continue.
- "Today" is the date on your phone's clock, in its time zone (America/Toronto if it can't tell).
- Install it on a phone or computer (web app manifest + icons).
- Offline: the check-in and habits pages open without a connection (the service worker saves them in
  advance). In demo mode the check-in fully works offline. In Supabase mode, answers saved offline
  are kept on the device and sent when you're back online ("Saved on this device, will sync").

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
   checkins, habit_entries). Table Editor should show all 4 tables with "RLS enabled".
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

## Test the PWA by hand
The service worker only runs in a production build (in `npm run dev` it is switched off on purpose,
see LEARNING.md).

```bash
npm run build
npm start          # http://localhost:3001
```

1. Open http://localhost:3001 in Chrome. Sign up, pick a username.
2. DevTools (F12) > Application > Manifest: no errors, icons shown. Service workers: `sw.js` is
   "activated and is running". Cache storage: `wellbeing-pages-v1` (with `/checkin` and `/habits`
   in it) and `wellbeing-static-v1`.
3. DevTools > Network > set "No throttling" to **Offline**. Reload: the home page still opens with
   your name. Go to `/checkin` and `/profile`: they work. Go to `/abc`: "You're offline".
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
| `npm test` | Vitest: auth, profile cache, service worker rules, manifest and icons, check-in logic (dates, validation, merging, demo store, offline queue, SQL privacy rules) |
| `npm run icons` | Redraws the PNG icons (`scripts/make-icons.mjs`) |

## Folder map
- `app/`: pages (`/`, `/checkin`, `/habits`, `/login`, `/signup`, `/onboarding`, `/profile`,
  `/offline`), the layout, the manifest (`manifest.ts`), icons and global styles.
- `components/`: React components (forms, nav bar, home, profile, habits, service worker
  registration). `components/checkin/`: the check-in flow, its 5 screens and the "save as you go" hook.
- `lib/auth/`: accounts. One `AuthService` interface, a Supabase version and a demo (localStorage)
  version, chosen by whether the Supabase keys are set. Copied from `apps/media-log`.
- `lib/checkin/`: check-ins and habits. One `CheckinStore` interface, a Supabase version and a demo
  (localStorage) version, plus the offline queue that wraps the Supabase one. Also the pure logic:
  today's date key, validation, merging partial saves.
- `lib/pwa/`: tests for the service worker and the manifest.
- `public/sw.js`: the service worker. `public/icons/`: app icons.
- `supabase/migrations/`: SQL to create the tables, with Row Level Security.

## Privacy
Your check-ins (mood, screen time, gratitude and journal) are readable only by you. This is enforced
by the database's Row Level Security, not just the app: the `checkins` table has owner-only rules and
will never get a "friends can read" rule. What friends will see in Stage 4 (shared habit streaks) lives
in a separate table with no text in it. See the note at the top of
`supabase/migrations/20261105110000_checkins_habits.sql`.

The service worker never stores personal data: only page shells, code and icons, which are the same
for everyone. In Supabase mode, two things are kept in this browser's localStorage: answers saved
while offline (deleted as soon as they reach Supabase) and your habit list (names only, so the
check-in works offline).
