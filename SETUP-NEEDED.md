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
