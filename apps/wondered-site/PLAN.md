# PLAN.md: "Have You Ever Wondered" website

## Goal
A website of short, well-explained answers to everyday "have you ever wondered...?" questions, STEM first. It's the home base for the YouTube channel of the same name: each video gets a page, and each page can link to its video.

## Stack (overrides CLAUDE.md default)
- Astro (static site, very fast, great for content) + TypeScript + Tailwind
- Content written as MDX files in the repo. No database needed.
- Hosted on Vercel or GitHub Pages.

## Scope
In: question pages, categories (physics, chemistry, biology, math, tech, everyday), search, a "random question" button, YouTube embeds, a "suggest a question" form.
Out: user accounts, comments, an admin panel (you add questions by adding files).

## Content format (one file per question)
```
src/content/questions/why-is-the-sky-blue.mdx
---
title: "Why is the sky blue?"
category: physics
short_answer: "One-sentence answer."
youtube_id: ""        # optional
sources: ["https://..."]
date: 2026-11-05
---
Full explanation with headings, diagrams, maybe a small interactive demo.
```

## Stages

### Stage 1: Skeleton + content system
- Astro project, content collection with the schema above (validated, so a missing title causes an error).
- Home page, question page template, category pages.
- 3 sample questions with real, accurate content and sources.
- Done when: adding a new .mdx file automatically creates its page.

### Stage 2: Discovery
- Search across titles and short answers. Use Pagefind (static search, no server).
- "Random question" button, "related questions" on each page (same category).
- Nice design: big readable question titles, clean typography, dark mode.

### Stage 3: Video + interactivity
- YouTube embed component (loads only on click, which keeps pages fast).
- One reusable interactive component (e.g. a slider demo) as an example of what's possible in MDX.
- "Suggest a question" form. Use a free form service like Formspree so no backend is needed.

### Stage 4: Ship it
- SEO: page titles, descriptions, social share images generated per question.
- GitHub Actions: build check on every push.
- Deploy. README section "How to add a new question in 5 minutes".
- A `QUESTION_TEMPLATE.mdx` I can copy.

## Kickoff prompt
```
Read CLAUDE.md and PLAN.md. Do Stage 1 only. Start with a short plan,
then build it, commit and push. Update LEARNING.md.
```
