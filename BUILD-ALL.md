# BUILD-ALL.md: instructions for the orchestrator session

You are the orchestrator. Your job is to build every app in `apps/` by working through PROGRESS.md from top to bottom, without stopping to ask me questions. I'm a beginner and I won't be watching.

## The loop
Repeat until every line in PROGRESS.md is ticked or skipped:

1. Open PROGRESS.md and find the first unticked line `- [ ]`.
2. Hand that ONE stage/task to a **subagent** (Agent tool, general-purpose) with this prompt, filling in the blanks:
   > Work only inside `apps/<APP>/`. Read the root CLAUDE.md, then `apps/<APP>/CLAUDE.md` if it exists (it overrides the root one), then `apps/<APP>/PLAN.md`. Do <STAGE/TASK> only. Follow the rules for LEARNING.md and tests. Run the tests and make them pass. Do NOT commit. When done, reply with: files changed, test result, and anything I must set up myself.
   Using a fresh subagent for each stage keeps your own context small. That is what keeps this cheap. Never build a stage yourself in your main context.
3. When the subagent returns, check its work yourself: run the app's tests and lint, and look at the diff. If tests fail, send ONE follow-up subagent to fix the root cause. If it still fails, revert that stage's changes, mark the line `- [!]` with a short reason, and move on.
4. Tick the line in PROGRESS.md (`- [x]`). Also tick the matching checkbox in the app's PLAN.md if it has one.
5. Commit with message `<app>: <stage/task title>` and **push to main right away**, so nothing is lost if credit runs out mid-run.
6. Go back to step 1.

## Rules for things you can't do
- **A task says "STOP" or "I will choose"** (e.g. workout 4.0, budget 4.0): do the research part, write the recommendation in LEARNING.md, mark the line `- [?] needs Amasten's choice`, and **skip the rest of that app's lines**. Move on to the next app.
- **An API key or account is needed** (TMDB, IGDB, Supabase, Vercel, Formspree, a stock price API): never stop to ask. Build it so it works without the key, using mock/sample data or localStorage behind the same interface, add a clear entry to SETUP-NEEDED.md (what to create, where to paste the key, which file switches from mock to real), and continue.
- **Deploy stages**: prepare everything (config files, README deploy steps) but don't deploy. Add the steps to SETUP-NEEDED.md.
- Never put real secrets in the repo.

## Keeping costs down
- Short commit messages, no long summaries between stages.
- Don't re-read whole apps you've already finished.
- Don't refactor finished apps. Only the stage in front of you.

## When you finish (or every 5 stages)
Update the "Status" section at the top of PROGRESS.md: what's done, what's blocked and why, and the single best next thing for me to do. Commit and push.
