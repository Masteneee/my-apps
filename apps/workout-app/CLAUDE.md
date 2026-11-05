# Workout App

## Why
A workout web app for young beginners: build routines, log workouts, understand
why a split works, and later share routines Reddit-style (upvotes, comments,
forks with visible lineage). Free core features, no guilt, no paywalled basics.
It's also my learning project: I'm a beginner learning to code for fun.

## What
- Plain HTML, CSS and JavaScript. No frameworks, no build step, no npm packages
  unless PLAN.md says so.
- Files:
  - `index.html` page structure
  - `style.css` all styling
  - `app.js` UI: forms, rendering, events
  - `logic.js` pure functions only (progress, volume, copying a routine). No DOM, no storage.
  - `storage.js` the ONLY file that reads or writes data (localStorage now, a database in phase 4)
  - `data/splits.js` starter splits and their explanations
  - `tests.js` tests for logic.js using Node's built-in `assert`
  - `LEARNING.md` my study notes (you add to it every session)
- Weights are stored in kg as numbers; the display unit (kg or lb) is a setting.
- The site is published with GitHub Pages from the main branch, so it must work
  by opening `index.html` directly, with no server.

## How
- Run tests: `node tests.js` (must pass before you finish a task)
- Work on ONE unchecked task from PLAN.md per session. Never start the next one.
- Before writing code, explain your plan in 3 to 6 short bullet points.
- Keep changes small. Prefer simple, readable code over clever code.
- Use clear variable names and short comments that explain WHY, not what.
- If something in the task is unclear, choose the simplest option and write
  the choice in LEARNING.md under "Decisions".
- When debugging: state a theory, add a check (console.log or a test) to confirm it,
  then fix the root cause. Remove temporary logs after.
- Never copy paid programs from coaches or influencers. Write original routines
  and explanations based on general training principles.

## End of every session
1. Tick the task's checkbox in PLAN.md.
2. Add a section to LEARNING.md with the task number and date:
   - What we built, in plain words (5 to 10 lines)
   - Each new concept explained like I'm a smart beginner
   - The most important lines of code, quoted and explained
   - 2 quiz questions for me, answers hidden under an "Answers" line
3. Write a clear commit message that says what changed and how I can test it
   by hand in the browser. Commit and push.

## Tone in the app
Encouraging and neutral. Missed workouts are not failures. No body-shaming,
no extreme diet or "no pain no gain" content.
