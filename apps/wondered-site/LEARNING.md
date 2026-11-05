# LEARNING.md: Have You Ever Wondered site

## Stage 1: Skeleton + content system (2026-11-04)

### What we built
An Astro website that reads question files from `src/content/questions/` and turns each one into a page.
There is a home page listing every question, one page per question, and one page per category.
Each question file is checked against a schema, so a typo or a missing field stops the build instead of
publishing a broken page. Three sample questions are included: the blue sky (physics), floating ice
(chemistry) and onions making you cry (biology).

### New concepts

**Static site.** A static site is a folder of ready-made HTML files. All the work (reading content,
building pages) happens once, when you run `npm run build`, and the result in `dist/` can be put on any
simple host like GitHub Pages or Vercel. There's no server running code for each visitor, which is
why static sites are fast, cheap and hard to break.

**Astro.** Astro is a tool that builds static sites. You write `.astro` files, which look like HTML with a
"code fence" on top (between the `---` lines) where you can run JavaScript/TypeScript. That code runs at
build time on your computer, not in the visitor's browser, so by default Astro sends zero JavaScript
to the browser.

**File-based routing.** Every file in `src/pages/` becomes a URL. `src/pages/index.astro` is `/`.
A name in square brackets like `questions/[slug].astro` is a *dynamic route*: one template that
makes many pages. Its `getStaticPaths()` function returns the list of all slugs, so Astro knows which
pages to build. That's how a new `.mdx` file automatically gets its own page.

**Content collections.** A collection is a folder of similar content (here: questions) that Astro
loads for you. `getCollection('questions')` gives you an array of all questions, already parsed and
typed, and `render(question)` turns its body into something you can put on a page.

**Frontmatter and schema validation.** Frontmatter is the block between `---` lines at the top of a
content file. It holds data about the page (title, category, date) written in YAML. The schema in
`src/content.config.ts` uses Zod, a validation library that ships inside Astro, to describe what valid
frontmatter looks like: `title` must be a non-empty string, `category` must be one of six words,
`sources` must be a list of real URLs. If a file breaks a rule, the build fails with a message like
`title: Required`.

**MDX.** MDX is Markdown (the simple `## heading` and `**bold**` syntax) plus the ability to use
components inside it. Right now our questions are plain Markdown, but in Stage 3 we'll drop a little
interactive slider straight into a question file.

**Tailwind CSS.** Tailwind is a set of tiny CSS classes like `text-3xl` (big text) or `p-4` (padding).
You style elements by stacking classes in the HTML instead of writing a separate CSS file. At build
time it only keeps the classes you actually used, so the CSS stays small (about 9 KB here).

**Pure functions and tests.** A pure function always gives the same output for the same input and
doesn't touch files, the network or the page. `src/lib/categories.ts` is pure, which is why Vitest can
test it in a fraction of a second without starting Astro.

### New dependencies (and why)
- `astro`: builds the site (the main tool).
- `@astrojs/mdx`: lets Astro read `.mdx` files.
- `tailwindcss` + `@tailwindcss/vite`: the styling classes, plugged into Vite (the bundler Astro uses).
- `vitest` (dev only): runs the tests.
- `typescript` + `@astrojs/check` (dev only): `npm run check` finds type errors in `.astro` files.

### Files and what each one does
- `package.json` project name, dependencies and the `npm run ...` scripts.
- `astro.config.mjs` turns on MDX and Tailwind.
- `tsconfig.json` TypeScript settings (Astro's "strict" preset).
- `vitest.config.ts` tells Vitest where the tests are.
- `.gitignore` keeps `node_modules/`, `dist/`, `.astro/` and env files out of git.
- `src/content.config.ts` the question schema.
- `src/content/questions/*.mdx` the three sample questions.
- `src/lib/categories.ts` category list, labels, sort and filter helpers.
- `src/lib/categories.test.ts` 5 tests for those helpers.
- `src/styles/global.css` loads Tailwind.
- `src/layouts/Base.astro` shared page frame.
- `src/components/QuestionList.astro` the list of question cards.
- `src/pages/index.astro` home page.
- `src/pages/questions/[slug].astro` one page per question.
- `src/pages/category/[category].astro` one page per category.

### Most important lines
```ts
category: z.enum(CATEGORIES),
```
The category must be one of the six words in `CATEGORIES`. Because the list lives in one place,
adding a seventh category later means editing one line.

```ts
return questions.map((question) => ({ params: { slug: question.id }, props: { question } }));
```
For each question file, "build a page whose URL slug is the file name, and hand it the question".
This one line is what makes new files turn into pages automatically.

### Decisions
- Category pages are built for all six categories, even empty ones, so home page links never lead to a 404.
- The URL slug is the file name (no separate `slug` field) to keep the format exactly as in PLAN.md.
- `sources` must have at least one URL: every answer on this site should be backed by a source.
- Links use paths starting with `/`. If the site is later hosted on GitHub Pages under `/repo-name/`,
  Stage 4 will need Astro's `base` setting.

### Practice exercise
Add a fourth question in the `math` category (for example "Why can't you divide by zero?").
Then try breaking it on purpose: change `category: math` to `category: maths` and run `npm run build`.
Read the error, fix it, and check that `/category/math/` now lists your question.

### Quiz
1. Why does the build fail if a question file has no `title`?
2. What does `getStaticPaths()` do in `questions/[slug].astro`?

Answers
1. The schema in `src/content.config.ts` says `title` is a required string, and Astro checks every file against it at build time.
2. It returns the list of every page to build (one per question file), with each page's slug and data.
