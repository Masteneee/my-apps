# PLAN.md: Study Tools (anti-procrastination + make it stick)

## Goal
Tools that make cégep studying stick and beat procrastination: spaced-repetition flashcards, a focus timer that tracks real study time per course, and subject-specific practice generators (Calcul 2, chimie, anatomie). Built from what I actually need for my own courses.

## The gap
Anki is powerful but ugly and hard to start with. Quizlet removed most free features. Neither knows that a Calcul 2 integral can be generated with infinite variations, or ties focus time to a course.

## Stack
Default. KaTeX for math rendering. Interface in French by default.

## Data model
- `courses`: id, user_id, name, code, color, exam_dates[]
- `decks`, `cards`: front, back (Markdown + LaTeX), course_id
- `reviews`: card_id, reviewed_at, grade, interval_days, ease (spaced repetition)
- `focus_sessions`: user_id, course_id, started_at, minutes, completed

## Stages

### Stage 1: Courses + flashcards
- Login (reuse), courses, decks, cards with LaTeX support.
- Review mode with keyboard shortcuts.

### Stage 2: Spaced repetition + exam mode
- Implement the SM-2 algorithm in a pure, heavily tested module. LEARNING.md explains it step by step (good practice for an engineer).
- "Exam in X days" mode that schedules reviews to finish before the exam date.
- CSV/Anki import.

### Stage 3: Focus timer + anti-procrastination
- Pomodoro timer linked to a course, with stats on hours per course per week.
- "Just 5 minutes" start button (the hardest part is starting), streaks.
- Integrate with the shorts blocker: the extension can check if a focus session is running and block more sites during it (optional, explain how they talk).

### Stage 4: Practice generators
- Calcul 2: random integration by parts / substitution exercises with step-by-step solutions (use a math library to verify answers).
- Chimie: stoichiometry and unit conversion problems with random values.
- Each generator is a small, tested module so I can add new subjects myself.
- Deploy, README.

## Kickoff prompt
```
Read CLAUDE.md and PLAN.md. Do Stage 1 only. Start with a short plan,
then build it, commit and push. Update LEARNING.md.
```
