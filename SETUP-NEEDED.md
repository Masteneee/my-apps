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
