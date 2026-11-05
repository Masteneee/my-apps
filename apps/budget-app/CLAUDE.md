# Budget App

## Why
A budgeting web app for young people that makes tracking money quick and guilt-free,
and teaches the basics of investing with a paper trading simulator.
It's also my learning project: I'm a beginner learning to code for fun.

## What
- Plain HTML, CSS and JavaScript. No frameworks, no build step, no npm packages
  unless PLAN.md says so (Chart.js from a CDN is allowed in phase 2).
- Files:
  - `index.html` page structure
  - `style.css` all styling
  - `app.js` UI: reading forms, showing data, events
  - `logic.js` pure functions only (totals, grouping, dates, money math). No DOM, no localStorage.
  - `storage.js` the ONLY file that touches localStorage
  - `tests.js` tests for logic.js using Node's built-in `assert`
  - `LEARNING.md` my study notes (you add to it every session)
- Money is stored in cents as integers (1250 = $12.50) to avoid decimal errors.
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

## End of every session
1. Tick the task's checkbox in PLAN.md.
2. Add a section to LEARNING.md with the task number and date:
   - What we built, in plain words (5 to 10 lines)
   - Each new concept explained like I'm a smart beginner (e.g. "what is an event listener")
   - The most important lines of code, quoted and explained
   - 2 quiz questions for me, answers hidden under a "Answers" line
3. Write a clear commit message that says what changed and how I can test it
   by hand in the browser. Commit and push.

## Tone in the app
No red warnings or guilt language. Show progress and "safe to spend", not failure.
All investing content is educational only: never recommend buying a specific stock.
