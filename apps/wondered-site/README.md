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

## Videos, interactive demos and the suggest form

- **Video:** put the video's 11 character ID in `youtube_id` (the part after `v=` in
  `https://www.youtube.com/watch?v=dQw4w9WgXcQ`). The page shows a "Play the video" button and only loads
  YouTube (from `youtube-nocookie.com`, privacy-enhanced mode) when it's clicked. Leave `youtube_id: ""`
  for no video. A pasted URL or wrong-length ID stops the build with a clear message.
- **Slider demo:** write `<SliderDemo demo="rayleigh" />` anywhere in an `.mdx` file (no import needed).
  To make a new demo, add an entry to `DEMOS` in `src/lib/demos.ts` (label, range, and a `compute` function).
- **Suggest a question (`/suggest/`):** posts to Formspree. Copy `.env.example` to `.env.local` and set
  `PUBLIC_FORMSPREE_ID` to your form's ID (and set the same variable on your host when you deploy).
  Without it, the page shows a friendly "coming soon" message instead of the form.
  The ID is read at build time, so restart `npm run dev` or rebuild after changing it.

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
- `src/lib/youtube.ts` ID check and embed/watch URLs, tested in `youtube.test.ts`
- `src/lib/demos.ts` the slider demos and their science (Rayleigh scattering), tested in `demos.test.ts`
- `src/lib/formspree.ts` turns the form ID into the Formspree URL (or null), tested in `formspree.test.ts`
- `src/lib/theme.ts` reads/saves the theme choice (wrapped in try/catch in case storage is blocked)
- `src/layouts/Base.astro` shared page frame (head, header with Search/Random/theme buttons, footer)
- `src/components/RandomButton.astro`, `src/components/ThemeToggle.astro` the header buttons
- `src/components/QuestionList.astro` list of question cards
- `src/components/YouTubeEmbed.astro` click-to-load video, `src/components/SliderDemo.astro` reusable slider
- `src/env.d.ts` lists the environment variables for TypeScript; `.env.example` shows which ones to set
- `src/pages/` every file here is a route: `index.astro` (home), `search.astro`, `suggest.astro`, `questions/[slug].astro`, `category/[category].astro`

## Status

Stage 1 (skeleton + content system), Stage 2 (discovery: search, random, related, dark mode) and
Stage 3 (click-to-load YouTube embeds, slider demo, suggest form) done. See `PLAN.md` for the next stages.
