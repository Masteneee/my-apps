# PLAN.md: Wellbeing / Habit Tracker

## Goal
A clean, minimal daily check-in (about 5 minutes) that tracks mood, screen time, journaling, gratitude, breathing/meditation and custom habits. Per-habit streaks, plus **shared streaks with a friend** (both of you must check in to keep it alive). It's a public portfolio project, built at about 2 hours a week.

## The gap
Daylio does mood, Streaks does habits, Finch is gamified, Headspace does meditation. Few combine all of them in one quick check-in, and shared friend streaks (the Snapchat mechanic, used for good) are rare in wellbeing apps.

## Stack
Default. Make it a PWA (installable on a phone from the browser, works offline for the check-in). Explain PWAs in LEARNING.md.

## Data model
- `profiles`: (same pattern as the media log)
- `habits`: id, user_id, name, icon, type (checkbox/number/minutes), target, is_archived
- `checkins`: id, user_id, date (unique per user per day), mood (1 to 5), mood_tags[], screen_time_minutes, gratitude[3], journal_text, created_at
- `habit_entries`: habit_id, date, value
- `shared_streaks`: id, habit_name, user_a, user_b, current_count, best_count, last_both_date
- `friendships`: user_a, user_b, status (pending/accepted)
- RLS: journal text is visible ONLY to its owner, never to friends.

## Stages

### Stage 1: Skeleton + accounts + PWA
- Reuse the login/profile setup from the media log (copy the code, don't rebuild from scratch).
- PWA manifest + service worker, installable on a phone.

### Stage 2: The daily check-in
- One flow, swipe or step-by-step: mood → screen time → 3 gratitudes → short journal → habits.
- Must take under 5 minutes, with big tap targets and mobile first.
- Saves even if I skip steps.

### Stage 3: Streaks + calendar
- Streak logic in a pure, well-tested module (`lib/streaks.ts`): missed days, timezone edge cases (I'm in America/Toronto), a "freeze" day.
- Calendar heatmap per habit and for mood.
- Breathing exercise screen (animated circle, 4-7-8 and box breathing).

### Stage 4: Friends + shared streaks
- Add a friend by username, accept/decline.
- Create a shared streak on a habit. It goes up only on days both people complete it.
- A gentle nudge: "Your friend checked in, your turn".

### Stage 5: Insights + ship
- Weekly summary: mood trend, which habits correlate with better mood days (simple averages, explained honestly, not fake AI).
- Export my data as JSON/CSV.
- Deploy, README with screenshots, privacy note.

## Kickoff prompt
```
Read CLAUDE.md and PLAN.md. Do Stage 1 only. Start with a short plan,
then build it, commit and push. Update LEARNING.md.
```
