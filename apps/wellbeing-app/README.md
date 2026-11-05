# Wellbeing

A calm, minimal daily check-in (about 5 minutes): mood, screen time, gratitude, a short journal and
habits, with per-habit streaks and shared streaks with a friend. It's a PWA: you can install it on your
phone from the browser, and it opens with no connection.

**Status:** Stage 1 of 5 done (skeleton, accounts, PWA). The check-in itself comes in Stage 2. See
[PLAN.md](PLAN.md) for all stages and [LEARNING.md](LEARNING.md) for what each stage taught.

## What works now
- Sign up / log in with email and password (Google login once Supabase is set up).
- Pick a username, see an empty "Today" home page and your profile (`/profile`), log out.
- Install it on a phone or computer (web app manifest + icons).
- Offline: pages you can reach open without a connection (a service worker saves them), and an
  "You're offline" page shows for anything not saved yet.

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
With no `.env.local`, the app runs in **demo mode**: accounts and profiles are saved only in your
browser (localStorage). A strip at the top says so. Good for trying things; nothing goes online.

### Real accounts (Supabase)
1. Create a free project at supabase.com.
2. SQL Editor > New query > paste `supabase/migrations/20261105100000_profiles.sql` > Run.
3. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings > API). Never the `service_role` key.
4. Authentication > URL Configuration: Site URL `http://localhost:3001`, and add
   `http://localhost:3001/onboarding` to Redirect URLs.
5. Restart `npm run dev`. The demo strip disappears.

Google login: create an OAuth client in Google Cloud Console with redirect URI
`https://<your-project>.supabase.co/auth/v1/callback`, then enable Google in Supabase >
Authentication > Sign In / Providers and paste its ID and secret.

## Test the PWA by hand
The service worker only runs in a production build (in `npm run dev` it is switched off on purpose,
see LEARNING.md).

```bash
npm run build
npm start          # http://localhost:3001
```

1. Open http://localhost:3001 in Chrome. Sign up, pick a username.
2. DevTools (F12) > Application > Manifest: no errors, icons shown. Service workers: `sw.js` is
   "activated and is running". Cache storage: `wellbeing-pages-v1` and `wellbeing-static-v1`.
3. DevTools > Network > set "No throttling" to **Offline**. Reload: the home page still opens with
   your name. Go to `/profile`: works. Go to `/abc`: "You're offline".
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
| `npm test` | Vitest: auth, profile cache, service worker rules, manifest and icons |
| `npm run icons` | Redraws the PNG icons (`scripts/make-icons.mjs`) |

## Folder map
- `app/`: pages (`/`, `/login`, `/signup`, `/onboarding`, `/profile`, `/offline`), the layout, the
  manifest (`manifest.ts`), icons and global styles.
- `components/`: React components (forms, nav bar, home, profile, service worker registration).
- `lib/auth/`: accounts. One `AuthService` interface, a Supabase version and a demo (localStorage)
  version, chosen by whether the Supabase keys are set. Copied from `apps/media-log`.
- `lib/pwa/`: tests for the service worker and the manifest.
- `public/sw.js`: the service worker. `public/icons/`: app icons.
- `supabase/migrations/`: SQL to create the tables, with Row Level Security.

## Privacy
Your journal will be readable only by you (enforced by the database's Row Level Security, Stage 2).
The service worker never stores personal data: only page shells, code and icons, which are the same
for everyone.
