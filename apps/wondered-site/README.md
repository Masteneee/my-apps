# Have You Ever Wondered (website)

Short, well-explained answers to everyday "have you ever wondered...?" questions, STEM first.
Home base for the YouTube channel of the same name. Built with Astro, TypeScript, Tailwind CSS and MDX.

## Run it

```bash
npm install      # once, downloads the tools listed in package.json
npm run dev      # local site at http://localhost:4321, reloads when you save
npm test         # runs the Vitest tests for src/lib
npm run check    # type-checks .astro and .ts files
npm run build    # builds the static site into dist/, then Pagefind adds the search index
npm run preview  # serves dist/ locally to see the real build
```

## Add a question

1. Create `src/content/questions/your-question-slug.mdx` (the file name becomes the URL).
2. Fill in the frontmatter: `title`, `category` (physics, chemistry, biology, math, tech, everyday),
   `short_answer`, `sources` (at least one link), `date`, and optionally `youtube_id`.
3. Write the explanation below the `---`. The page appears at `/questions/your-question-slug/`.

If a field is missing or wrong, `npm run build` stops and tells you which file and field.

## Search, random and dark mode

- Search (`/search/`) uses Pagefind. It indexes only each question's title and short answer, and the index
  is created by `npm run build`, so search works in `npm run preview` but not in `npm run dev`.
- "Random question" (in the header) jumps to a random question, never the one you're on.
- Each question page lists up to 3 related questions from the same category (hidden if there are none yet).
- The Dark/Light button remembers your choice in localStorage. With no saved choice, the site follows your system setting.

## Folder map

- `src/content.config.ts` the schema every question must follow
- `src/content/questions/` one `.mdx` file per question
- `src/lib/categories.ts` pure helpers (category list, labels, sorting), tested in `categories.test.ts`
- `src/lib/discovery.ts` pure helpers for related questions and random picks, tested in `discovery.test.ts`
- `src/lib/theme.ts` reads/saves the theme choice (wrapped in try/catch in case storage is blocked)
- `src/layouts/Base.astro` shared page frame (head, header with Search/Random/theme buttons, footer)
- `src/components/RandomButton.astro`, `src/components/ThemeToggle.astro` the header buttons
- `src/components/QuestionList.astro` list of question cards
- `src/pages/` every file here is a route: `index.astro` (home), `search.astro`, `questions/[slug].astro`, `category/[category].astro`

## Status

Stage 1 (skeleton + content system) and Stage 2 (discovery: search, random, related, dark mode) done. See `PLAN.md` for the next stages.
