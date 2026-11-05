# PROGRESS.md

Legend: `[ ]` to do, `[x]` done, `[?]` needs my choice, `[!]` failed (reason noted)

## Status
Done: shorts-blocker (3/3), wondered-site (4/4), media-log (7/7), wellbeing-app (5/5), budget-app phases 0 to 3. Nothing is deployed, and media-log and wellbeing-app run in demo mode with sample data until Supabase/TMDB/IGDB keys exist.
Waiting on me: budget-app 4.0, pick a stock-price data source (options A to E in apps/budget-app/LEARNING.md; recommended: Finnhub with each person's own key). workout-app and study-tools are for later.
Best next thing for me to do: create one Supabase project and run the media-log migrations (SETUP-NEEDED.md), so the flagship app can be tested for real before deploying.

## 1. shorts-blocker (Chrome extension)
- [x] Stage 1: Skeleton + YouTube
- [x] Stage 2: Other sites + settings
- [x] Stage 3: Polish + tests

## 2. wondered-site ("Have you ever wondered")
- [x] Stage 1: Skeleton + content system
- [x] Stage 2: Discovery
- [x] Stage 3: Video + interactivity
- [x] Stage 4: Ship it

## 3. media-log (flagship)
- [x] Stage 1: Skeleton + accounts
- [x] Stage 2: Database + movies
- [x] Stage 3: Unified search
- [x] Stage 4: Tracking + diary
- [x] Stage 5: Social
- [x] Stage 6: Stats + bridge recommendations
- [x] Stage 7: Ship + portfolio

## 4. wellbeing-app
- [x] Stage 1: Skeleton + accounts + PWA
- [x] Stage 2: Daily check-in
- [x] Stage 3: Streaks + calendar
- [x] Stage 4: Friends + shared streaks
- [x] Stage 5: Insights + ship

## 5. budget-app (plain HTML/JS, see its CLAUDE.md)
Group small tasks: one subagent per phase is fine for phases 0 to 2.
- [x] Phase 0: Setup (0.1)
- [x] Phase 1: Log money (1.1 to 1.6)
- [x] Phase 2: See it (2.1 to 2.4)
- [x] Phase 3: Goals without guilt (3.1 to 3.5)
- [?] Phase 4: Learn investing, needs Amasten's choice (4.0 research done, see budget-app LEARNING.md)

## 6. workout-app (plain HTML/JS, see its CLAUDE.md)
Group small tasks: one subagent per phase is fine for phases 0 to 3.
- [x] Phase 0: Setup (0.1)
- [ ] Phase 1: Routine builder (1.1 to 1.5)
- [ ] Phase 2: Log workouts (2.1 to 2.5)
- [ ] Phase 3: Beginner layer (3.1 to 3.4)
- [ ] Phase 4: Accounts (starts with 4.0, which needs my choice)
- [ ] Phase 5: Community (needs phase 4)

## 7. study-tools
- [ ] Stage 1: Courses + flashcards
- [ ] Stage 2: Spaced repetition + exam mode
- [ ] Stage 3: Focus timer + anti-procrastination
- [ ] Stage 4: Practice generators
