# Have You Ever Wondered (website)

Short, well-explained answers to everyday "have you ever wondered...?" questions, STEM first.
Home base for the YouTube channel of the same name. Built with Astro, TypeScript, Tailwind CSS and MDX.

## Run it

```bash
npm install      # once, downloads the tools listed in package.json
npm run dev      # local site at http://localhost:4321, reloads when you save
npm test         # runs the Vitest tests for src/lib
npm run check    # type-checks .astro and .ts files
npm run build    # builds the static site into dist/
npm run preview  # serves dist/ locally to see the real build
```

## Add a question

1. Create `src/content/questions/your-question-slug.mdx` (the file name becomes the URL).
2. Fill in the frontmatter: `title`, `category` (physics, chemistry, biology, math, tech, everyday),
   `short_answer`, `sources` (at least one link), `date`, and optionally `youtube_id`.
3. Write the explanation below the `---`. The page appears at `/questions/your-question-slug/`.

If a field is missing or wrong, `npm run build` stops and tells you which file and field.

## Folder map

- `src/content.config.ts` the schema every question must follow
- `src/content/questions/` one `.mdx` file per question
- `src/lib/categories.ts` pure helpers (category list, labels, sorting), tested in `categories.test.ts`
- `src/layouts/Base.astro` shared page frame (head, header, footer)
- `src/components/QuestionList.astro` list of question cards
- `src/pages/` every file here is a route: `index.astro` (home), `questions/[slug].astro`, `category/[category].astro`

## Status

Stage 1 (skeleton + content system) done. See `PLAN.md` for the next stages.
