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
