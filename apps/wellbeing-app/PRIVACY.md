# Privacy

What Wellbeing keeps, who can see it, and how to take it with you or delete it. The same text is in the
app at `/privacy` (`app/privacy/page.tsx`). If you change one, change the other.

## The short version
- Your **journal**, gratitudes, mood and screen time are **only for you**. Friends never see them.
- No ads, no trackers, no analytics, no AI. Insights are simple averages worked out on your own phone.
- You can download all of it any time (Profile > Your data).

## What is stored
- **Your account:** email, username and display name. Your password is handled by Supabase (the login
  service) and stored scrambled ("hashed"); the app never keeps it.
- **Check-ins:** for each day, your mood and mood words, screen time, 3 gratitudes and your journal.
- **Habits:** their names, emoji and goals, and which days you did them (with the amount).
- **Friends:** who you're friends with, requests, and your shared streaks (which habit, with whom).

## Who can see what
- **Only you:** your journal, gratitudes, mood, mood words, screen time, your habit amounts and goals.
  The database itself enforces this (Row Level Security), not just the app. See the notes at the top of
  `supabase/migrations/20261105110000_checkins_habits.sql`.
- **Your friends:** your username and display name, and, only for a habit you chose to share with them,
  which days you did it. Nothing else. (One database function, `shared_streak_days`, answers only "who
  did the shared habit on which day", and only to the two people in that shared streak.)
- **Other people with an account:** your username and display name, so friends can find you.
- **The person running this app:** the data is stored in their Supabase project. It isn't end-to-end
  encrypted, so they could technically open the database. They promise not to read it, but you should
  know it's possible.

## Demo mode
When the strip at the top says "Demo mode", nothing goes online at all: your account and every answer
are saved only in this browser (its localStorage). Anyone using this browser on this device could see
them, and clearing the browser's data erases them.

## What stays on your phone
- To work offline, the app saves its pages (the same for everyone, never your answers).
- Answers you save while offline wait on your phone and are deleted as soon as they reach the server.
  A copy of your habit names is kept so the check-in works offline.

## Take your data with you
Profile > Your data > **Download JSON** (everything, for a backup) or **Download CSV** (one row per day,
for Excel or Google Sheets). The file has your account, habits, check-ins (journal included) and habit
entries. Friends and shared streaks aren't in it, because they involve another person.

## Delete your data
- **Demo mode:** clear this site's data in your browser (in Chrome: the icon left of the address >
  Site settings > Delete data). Everything is gone.
- **With an account:** remove a friend and your shared streaks with them are deleted. To delete
  everything, ask the person running this app to delete your account (Supabase > Authentication >
  Users > Delete user). Your profile, habits, check-ins, habit entries and friendships are then deleted
  with it (`on delete cascade` in the migrations). There's no delete button in the app yet. Download your
  data first if you want to keep it.
- Logging out doesn't delete anything. On a shared computer, clear the site's data afterwards too.
