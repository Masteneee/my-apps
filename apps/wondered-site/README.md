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

## How to add a new question in 5 minutes

1. **Copy the template (30 s).** Copy `QUESTION_TEMPLATE.mdx` into `src/content/questions/` and rename it
   to the question in lowercase with dashes, e.g. `why-do-cats-purr.mdx`. The file name becomes the URL
   (`/questions/why-do-cats-purr/`) and the share image (`/og/why-do-cats-purr.png`).
2. **Fill in the frontmatter (2 min).** `title`, `category` (physics, chemistry, biology, math, tech, everyday),
   `short_answer` (key idea first: it is also the Google description and the share preview text),
   `sources` (at least one link you checked), `date`, and `youtube_id` (11 characters, or `""`).
3. **Write the explanation (as long as you like).** Below the second `---`, use `##` headings and short paragraphs.
   `<SliderDemo demo="rayleigh" />` works anywhere, no import needed.
4. **Check it (1 min).** `npm run dev` and open `http://localhost:4321/questions/why-do-cats-purr/`.
   Then `npm test && npm run check && npm run build`: if a field is missing or wrong, the build names the file and field.
5. **Publish (30 s).** Commit and push. GitHub Actions re-runs the checks, and Vercel rebuilds the site, so the page,
   its share image and its sitemap entry all appear on their own.

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

## SEO and share images

- Every page has a `<title>`, a meta description, a canonical URL and Open Graph / X tags (set in `src/layouts/Base.astro`).
  A question's description is its `short_answer`, cut to about 160 characters.
- Each question gets a 1200 x 630 share image, drawn at build time from `src/lib/og.ts` and saved as `/og/<slug>.png`.
  Other pages share `/og/site.png`.
- `/sitemap.xml` lists every page and `/robots.txt` points search engines to it.
- All full addresses use `SITE_URL`. Without it, the placeholder `https://wondered-site.vercel.app` is used, so
  set `SITE_URL` to your real address (in `.env.local` locally, and on Vercel).

## Deploy to Vercel (free)

Nothing is deployed yet. When you're ready:

1. Push the repo to GitHub, then sign in at vercel.com with your GitHub account.
2. **Add New... > Project**, pick the `my-apps` repository and click **Import**.
3. Next to **Root Directory**, click **Edit** and choose `apps/wondered-site`. This is the important step: the repo
   holds several apps, and this tells Vercel which one to build.
4. Vercel should detect **Astro**. Leave the build command as `npm run build` and the output directory as `dist`.
5. Open **Environment Variables** and add:
   - `PUBLIC_FORMSPREE_ID` = your Formspree form ID (only the ID, like `xyzabcde`)
   - `SITE_URL` = the address Vercel will give you, e.g. `https://your-project.vercel.app` (you can fix it after
     the first deploy once you see the real address)
6. Click **Deploy**. When it's done, open the site and check a question page, `/sitemap.xml` and `/og/why-is-the-sky-blue.png`.
7. If you changed `SITE_URL` after the first deploy, go to **Deployments**, open the menu on the latest one and
   choose **Redeploy** (variables are only read during a build).
8. Test a share preview by pasting a question URL into a Discord or iMessage chat to yourself.

After that, every push to `main` that touches the site redeploys it automatically.

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
- `src/lib/seo.ts` site address, descriptions, titles and the sitemap XML, tested in `seo.test.ts`
- `src/lib/og.ts` draws the share image as SVG (title wrapping, layout), tested in `og.test.ts`
- `src/lib/theme.ts` reads/saves the theme choice (wrapped in try/catch in case storage is blocked)
- `src/layouts/Base.astro` shared page frame (head, header with Search/Random/theme buttons, footer)
- `src/components/RandomButton.astro`, `src/components/ThemeToggle.astro` the header buttons
- `src/components/QuestionList.astro` list of question cards
- `src/components/YouTubeEmbed.astro` click-to-load video, `src/components/SliderDemo.astro` reusable slider
- `src/env.d.ts` lists the environment variables for TypeScript; `.env.example` shows which ones to set
- `src/pages/` every file here is a route: `index.astro` (home), `search.astro`, `suggest.astro`, `questions/[slug].astro`, `category/[category].astro`,
  plus files that build non-HTML output: `og/[slug].png.ts`, `og/site.png.ts`, `sitemap.xml.ts`, `robots.txt.ts`
- `QUESTION_TEMPLATE.mdx` the file to copy for a new question (outside `src/content`, so it never becomes a page)
- `../../.github/workflows/wondered-site.yml` runs tests, check and build on GitHub for every push and pull request

## Status

Stage 1 (skeleton + content system), Stage 2 (discovery: search, random, related, dark mode),
Stage 3 (click-to-load YouTube embeds, slider demo, suggest form) and Stage 4 (SEO, share images, GitHub Actions,
template, deploy steps) done. The site is not deployed yet: follow "Deploy to Vercel" above.
