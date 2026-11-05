# CLAUDE.md (shared rules for every app in this repo)

This repo holds several independent apps in `apps/<name>/`. Each app has its own PLAN.md. If an app folder has its own CLAUDE.md, its rules override this file for that app (e.g. workout-app and budget-app use plain HTML/JS, not Next.js).

## Who I am
I'm a beginner learning to code as a hobby. I'm a cégep student aiming for engineering, and my time is limited. I want to understand what gets built, not just have it built.

## How to work in this repo
1. Read the app's PLAN.md first. Only do the stage I ask for. Never start the next stage on your own.
2. Before coding a stage, write a short plan (5 to 10 lines) of what you'll change, then do it.
3. Keep changes small and focused. One stage (or one task) = one commit.
4. Comment the code where a beginner would get lost (why, not just what).
5. At the end of each stage, update the app's `LEARNING.md` with:
   - the new concepts this stage used (explained in plain language, 2 to 4 sentences each)
   - which files changed and what each one does
   - one small exercise I can try myself to practice
6. Every commit message must say what changed and how to test it by hand. Anything I must set up myself (API keys, accounts) goes in the root `SETUP-NEEDED.md`.
7. Don't add libraries unless they save real work. Explain each new dependency in LEARNING.md.
8. Never commit secrets. Use `.env.local` and keep an up-to-date `.env.example`.
9. When debugging: state a theory, gather evidence (logs, a test), fix the root cause only once confirmed.
10. Write tests for logic (calculations, data merging, streaks). Don't bother testing pure layout.

## Default stack (unless PLAN.md says otherwise)
- Next.js (App Router) + TypeScript
- Tailwind CSS for styling
- Supabase (free tier) for database + login
- Vitest for tests
- GitHub Actions to run lint + tests on every push (one workflow per app in `.github/workflows/`, filtered to that app's folder with `paths:`)
- Vercel (free tier) for hosting

## Definition of done for a stage
- Lint and tests pass (from inside the app folder)
- The app runs locally
- LEARNING.md and README.md are updated
- The stage is committed and pushed, and PROGRESS.md is ticked
