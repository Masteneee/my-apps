# SETUP-NEEDED.md

Things only I (Amasten) can do: accounts, API keys, deploying, and choices the plans leave to me. Claude Code adds to this list as it builds.

## Accounts I'll probably need (all free)
- [ ] Supabase (database + login for media-log, wellbeing-app, study-tools)
- [ ] Vercel (hosting)
- [ ] TMDB API key (movies/TV in media-log)
- [ ] Twitch developer account for IGDB (games in media-log)

## Added during the build
- [ ] **shorts-blocker:** load it in Chrome (`chrome://extensions` > Developer mode > Load unpacked > `apps/shorts-blocker`) and run the README's "Test it by hand" steps. Selectors for Instagram/Facebook/Snapchat were never tested on the live sites.
- [ ] **wondered-site:** click each source link in the 3 sample questions once to confirm it opens (the build couldn't reach the web).
- [ ] **wondered-site:** create a free Formspree form, copy `.env.example` to `.env.local` in `apps/wondered-site`, and paste the form ID into `PUBLIC_FORMSPREE_ID` (also on the host when deploying). Until then the suggest page shows "coming soon".
- [ ] **wondered-site deploy:** on Vercel, import `my-apps`, set Root Directory to `apps/wondered-site`, add env vars `SITE_URL` (your real URL) and `PUBLIC_FORMSPREE_ID`. After the first deploy, open one share image (`/og/<question>.png`) to check the font looks right.
- [ ] **media-log:** create a free Supabase project. In SQL Editor, paste and run `apps/media-log/supabase/migrations/20261105000000_profiles.sql`. Then copy `apps/media-log/.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings > API; the anon/publishable key, never the service_role key). Until then the app runs in demo mode and saves accounts only in your browser.
- [ ] **media-log:** in Supabase, Authentication > URL Configuration: set Site URL to `http://localhost:3000` and add `http://localhost:3000/onboarding` to Redirect URLs (add your Vercel URL + `/onboarding` when deploying). Optional for local testing: turn off "Confirm email" under Authentication > Sign In / Providers > Email.
- [ ] **media-log (Google login):** in Google Cloud Console, create an OAuth client ID (Web application) with redirect URI `https://<your-project>.supabase.co/auth/v1/callback`. Then in Supabase > Authentication > Sign In / Providers > Google, enable it and paste the client ID and secret. The button is disabled until Supabase keys are set.
- [ ] **media-log:** after adding the keys, test once by hand: sign up, confirm the email, pick a username, see `/u/<username>`, then try Google login. Never tested against a real Supabase project.
- [ ] **media-log (Stage 2 database):** in Supabase SQL Editor, run `apps/media-log/supabase/migrations/20261105010000_media_logs_lists_follows.sql` (AFTER the profiles file). Table Editor should then show 6 tables, each with "RLS enabled".
- [ ] **media-log (TMDB):** create a free account at themoviedb.org > Settings > API (Developer key, "personal learning project"). Copy the API Read Access Token into `TMDB_READ_ACCESS_TOKEN` in `apps/media-log/.env.local` (or the short API Key into `TMDB_API_KEY`). Restart `npm run dev`. Until then `/search` uses a saved sample of 13 movies. On Vercel, add the same variable (no NEXT_PUBLIC_ prefix).
- [ ] **media-log:** after adding the TMDB key, search a movie not in the sample (e.g. "Amélie"), check posters load, log it. Also check sample posters load without a key ("Interstellar"). Never tested against the real TMDB API.
- [ ] **media-log:** with Supabase connected, log a movie, see it on `/u/<username>`, then open the profile logged out in a private window and check the logs are visible.
- [ ] **media-log (IGDB games):** at dev.twitch.tv/console (Twitch account with 2FA) > Applications > Register Your Application (redirect URL `http://localhost`, Client Type Confidential). Copy the Client ID and a new Client Secret into `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` in `apps/media-log/.env.local` (and on Vercel). Until then games come from a saved sample of 11.
- [ ] **media-log (Stage 3):** with internet, search `dune`, `frieren`, `zelda` on `/search` and check that AniList, Open Library, TMDB series and IGDB answer live (no "Sample data" note) and covers load. Live calls were never tested; the sample data was written from memory.
- [ ] **media-log (Stage 4 database):** in Supabase SQL Editor, run `apps/media-log/supabase/migrations/20261105020000_progress_units.sql` (AFTER the two earlier files). Table Editor > logs should then have a `progress_unit` column.
- [ ] **media-log (Stage 4):** with Supabase connected, log an anime as Watching, press "+1 ep" on its item page until the last episode (it should turn "Watched"), check `/u/<username>/diary`, and open the item page logged out (average rating visible).
- [ ] **media-log (Stage 5 database):** in Supabase SQL Editor, run `apps/media-log/supabase/migrations/20261105030000_review_likes.sql` (AFTER the three earlier files). Table Editor should then show a 7th table, `review_likes`, with "RLS enabled".
- [ ] **media-log (Stage 5):** with Supabase connected, use two accounts (normal + private window): follow one from the other, check `/feed`, like a review, make a list and reorder it, and check a private list is hidden from the other account.
- [ ] **media-log (Stage 6 database):** in Supabase SQL Editor, run `apps/media-log/supabase/migrations/20261105040000_media_genres.sql` (AFTER the four earlier files). Table Editor > media_items should then have a `genres` column.
- [ ] **media-log (Stage 6):** with Supabase connected, log 3 movies/books rated 4★+, check the home page shows bridge picks (anime, manga, game) with reasons, and open `/u/<username>/stats`. With internet, check live results get tags on their item page (genre fields never tested against the real APIs).
