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
