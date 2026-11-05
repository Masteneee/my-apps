# Workout App Plan

One task = one Claude Code session. Do them in order. Each task ends with
working code, passing tests (`node tests.js`), an updated LEARNING.md and a commit.

How to start a session: "Read CLAUDE.md and PLAN.md. Do the next unchecked task only."

---

## Phase 0: Setup

- [ ] **0.1 Project skeleton.** Create index.html, style.css, app.js, logic.js,
  storage.js, data/splits.js, tests.js and LEARNING.md. The page has three empty
  tabs: Routines, Log, Learn. tests.js runs one trivial test.

## Phase 1: Routine builder

- [ ] **1.1 Exercise list.** A starter list of about 30 common exercises in
  data/exercises.js (name, muscle group, equipment). Searchable by name.
- [ ] **1.2 Create a routine.** Name it, add exercises, set sets, reps and rest time
  per exercise. Save through storage.js. Explain nested data (a routine holds
  exercises, an exercise holds sets) in LEARNING.md.
- [ ] **1.3 Edit, reorder, delete.** Change a routine, move exercises up or down,
  delete with a confirm step.
- [ ] **1.4 Fork.** "Make a copy" creates a new routine with "forkedFrom" set to the
  original's id and name. Show "Forked from X" on the copy. Test the copy logic
  (the copy must not change when the original changes).
- [ ] **1.5 Phone-friendly layout.** Big tap targets, one column, works one-handed.

## Phase 2: Log workouts

- [ ] **2.1 Start a workout.** Pick a routine, then log weight and reps for each set,
  ticking sets as done. Save the finished workout with a date.
- [ ] **2.2 Last time.** Next to each set, show what I did last time for that
  exercise. Logic in logic.js with tests.
- [ ] **2.3 Rest timer.** Starts automatically when a set is ticked, using the
  routine's rest time. Explain setInterval in LEARNING.md.
- [ ] **2.4 History and progress.** A history list, and a chart per exercise of best
  weight over time (Chart.js from a CDN).
- [ ] **2.5 Export and import.** Download all data as JSON and load it back.

## Phase 3: Beginner layer

- [ ] **3.1 Starter splits.** In data/splits.js, 4 original starter routines:
  full body (3 days), upper/lower (4 days), push/pull/legs (3 or 6 days),
  and a no-equipment home routine. One tap to copy any into my routines (a fork).
- [ ] **3.2 Why this split.** Each split gets a short card: who it's for, days per
  week, how long a session takes, how to progress. Max 100 words, plain language.
- [ ] **3.3 Progression hints.** If I hit all target reps two sessions in a row,
  suggest a small weight increase. Neutral wording. Tested in logic.js.
- [ ] **3.4 Learn tab.** 6 short cards: progressive overload, sets and reps, rest
  days, warm-up, form over weight, sleep and food basics. No calorie targets.

## Phase 4: Accounts and an online database

- [ ] **4.0 Choose a backend.** Compare Supabase and Firebase for this app in
  LEARNING.md: free tier, how login works, how to keep users from editing each
  other's data, and what changes in storage.js. Recommend one and STOP. I will
  choose and create the account myself before 4.1.
- [ ] **4.1 Sign up and log in.** Email login. Logged-out users still see the app.
- [ ] **4.2 Move data online.** storage.js saves routines and workouts to the
  database for logged-in users. Offer to upload existing local data once.
- [ ] **4.3 Security rules.** Users can only read and edit their own private data.
  Explain the rules in LEARNING.md and test them.

## Phase 5: The community

- [ ] **5.1 Publish a routine.** Make a routine public with a title and description.
  A "Community" tab lists public routines.
- [ ] **5.2 Upvotes and sorting.** One upvote per user per routine. Sort by Top and New.
- [ ] **5.3 Comments.** Comment on a public routine. Delete your own comments.
- [ ] **5.4 Public forks.** Copying a public routine records the lineage. Show
  "forked from X" and "12 forks", with a link to the forks.
- [ ] **5.5 Moderation.** Report button, and an admin view for me to hide posts.
  Community is 18+ at first; explain why in LEARNING.md.

## Later (not now)

- AI helper with the Claude API ("adapt this routine to 3 days"). Needs a small
  server to hide the API key and a Console account with paid API credits.
