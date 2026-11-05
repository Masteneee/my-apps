# PLAN.md: All-Media Log (flagship project)

## Goal
One place to log, rate and review everything you watch, read and play: movies, series, anime, manga, books, games. It has the feel of Letterboxd (diary, reviews, lists, a pretty profile) and AniList-style tracking (episode/chapter progress, status). The bigger mission: help niche media (games, manga, anime) reach people who only use mainstream apps, by putting them side by side with movies.

## The gap vs existing apps
Letterboxd = movies only. AniList/MAL = anime/manga only. Goodreads = books only. Backloggd = games only. Nobody does all of them with one profile and one taste graph. Cross-media recommendations ("you loved Interstellar, try the manga Planetes") are the hook.

## Stack
Default (Next.js + TypeScript + Tailwind + Supabase + Vitest + Vercel).

## External data sources
| Media | Source | Key needed |
|-------|--------|-----------|
| Movies, series | TMDB | yes (free) |
| Anime, manga | AniList GraphQL | no |
| Books | Open Library | no |
| Games | IGDB (via Twitch dev account) | yes (free) |

Never store whole external catalogs. Store a cached copy of an item only when a user logs it.

## Data model (first version)
- `profiles`: id, username, display_name, avatar_url, bio
- `media_items`: id, type (movie/series/anime/manga/book/game), source, source_id, title, year, cover_url, creators, total_units (episodes/chapters/pages), cached_at. Unique on (source, source_id).
- `logs`: id, user_id, media_item_id, status (planned/in_progress/completed/dropped/paused), rating (0.5 to 5), progress, review_text, started_at, finished_at, rewatch, created_at
- `lists`: id, user_id, title, description, is_public
- `list_items`: list_id, media_item_id, position, note
- `follows`: follower_id, following_id
- Row Level Security on everything (explain RLS in LEARNING.md).

## Stages

### Stage 1: Skeleton + accounts
- Next.js app, Supabase project, sign up/login (email + Google), profile creation with a username.
- Base layout: nav bar, dark theme, responsive.
- GitHub Actions running lint + tests.
- Done when: I can sign up, pick a username and see my empty profile at `/u/username`.

### Stage 2: Database + one media type (movies)
- Migrations for the tables above, with RLS.
- TMDB search, add a movie to my log with a status, rating and review.
- Profile shows my logged movies as a poster grid.
- Done when: search a movie, log it, see it on my profile.

### Stage 3: Unified search (the hard part)
- An adapter per source (`lib/sources/tmdb.ts`, `anilist.ts`, `openlibrary.ts`, `igdb.ts`), each converting results into ONE shared `MediaResult` type.
- One search bar with type filters. Results merged and deduplicated.
- Unit tests for each adapter, using saved sample API responses (no live calls in tests).
- LEARNING.md: explain the adapter pattern and why it matters here.

### Stage 4: Tracking + diary
- Progress tracking (episode 7/24, chapter 120/?, 45% of a book, hours in a game).
- Diary view: a timeline of everything I logged, grouped by month.
- Item page `/media/[type]/[id]` with cover, info, my log, and everyone's average rating.

### Stage 5: Social
- Follow users, a home feed of what people I follow logged and reviewed.
- Likes on reviews.
- Public lists ("Best anime for people who don't watch anime") with drag-to-reorder.

### Stage 6: Stats + "bridge" recommendations
- Stats page: count per media type, rating distribution, top genres, a yearly recap.
- Simple cross-media recommendations from shared genres/tags between items I rated 4+ and items in other media types. Keep it rule-based and explainable, no AI model needed.
- "Bridge picks" section on the home page: niche items recommended to mainstream users.

### Stage 7: Ship + portfolio
- Deploy to Vercel, seed a demo account with real logs.
- README with screenshots, the gap statement, the architecture diagram (Mermaid).
- ARCHITECTURE.md explaining every folder and how a search request flows end to end.
- Basic performance pass (image optimization, caching API responses).

## Kickoff prompt
```
Read CLAUDE.md and PLAN.md. Do Stage 1 only. Start with a short plan,
then build it, commit and push. Update LEARNING.md.
```
