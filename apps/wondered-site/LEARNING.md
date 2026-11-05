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

## Stage 2: Discovery (2026-11-04)

### What we built
A search page, a "Random question" button, "related questions" at the bottom of each question page,
and a cleaner design with a dark mode toggle. Search is done by Pagefind, which reads the finished HTML
after `astro build` and makes a small search index that runs entirely in the visitor's browser, so we
still need no server. The random button and related questions use two small pure functions in
`src/lib/discovery.ts`, which have 6 new Vitest tests. Titles are bigger and bolder, body text is larger
with more line spacing, and every colour has a dark version.

### New concepts

**Static search (Pagefind).** A normal search box sends your words to a server that looks them up.
Pagefind instead builds the index ahead of time, splits it into small files in `dist/pagefind/`, and the
browser downloads only the pieces it needs for what you type. The `data-pagefind-body` attribute marks
which part of a page to index; we put it around the title and short answer only. Because the index is
made from `dist/`, search only works after a build (`npm run build` then `npm run preview`).

**Chaining commands with `&&`.** Our build script is `astro build && pagefind --site dist`. The `&&`
means "run the second command only if the first one succeeded", so Pagefind never indexes a broken build.

**Custom elements.** `<random-question>` is an HTML tag we invented. `customElements.define(...)` tells
the browser "when you see this tag, run this class". Its `connectedCallback` runs when the tag appears on
the page, which is where we attach the click handler. Pagefind's `<pagefind-input>` and
`<pagefind-results>` work the same way.

**Passing build-time data to the browser.** Astro code runs at build time, but the click happens later
in the browser. We bridge the gap by writing the list of slugs into an HTML attribute
(`data-slugs="[...]"`) and reading it back with `this.dataset.slugs` in the browser.

**Dark mode with a class.** Tailwind's `dark:` classes (like `dark:bg-slate-950`) normally follow the
system setting. One line in `global.css` (`@custom-variant dark ...`) makes them follow a `dark` class on
`<html>` instead, so a button can switch it. The button calls `classList.toggle('dark')`.

**localStorage and try/catch.** localStorage is a tiny key/value store in the browser that survives page
reloads. In private browsing or with strict settings it can throw an error, so every read and write is
inside `try { ... } catch { ... }`: if it fails, the toggle still works, it just isn't remembered.

**Avoiding the white flash.** If dark mode were applied by a normal script, the page would first draw in
light colours and then switch. A tiny `<script is:inline>` in `<head>` runs before anything is drawn,
reads the saved choice (or the system preference) and adds the `dark` class right away.

**Injecting randomness for tests.** `Math.random()` gives a different number each time, which makes tests
unpredictable. `pickRandomSlug` takes the random function as a parameter: the browser passes
`Math.random`, the tests pass `() => 0` or `() => 0.999` and know exactly what to expect.

### New dependency (and why)
- `pagefind` (dev only): builds the search index and ships the ready-made search box. Writing our own
  search (index, ranking, highlighting) would be a lot of work for the same result.

### Files and what each one does
- `package.json` build script now runs Pagefind after Astro; `pagefind` added.
- `src/lib/discovery.ts` `relatedQuestions` (same category, not itself, newest first, max 3) and `pickRandomSlug`.
- `src/lib/discovery.test.ts` 6 tests for those two functions.
- `src/lib/theme.ts` `savedTheme` / `saveTheme`, the try/catch-wrapped localStorage helpers.
- `src/components/ThemeToggle.astro` the Dark/Light button.
- `src/components/RandomButton.astro` the Random question button.
- `src/pages/search.astro` the search page using Pagefind's Component UI.
- `src/layouts/Base.astro` header buttons, the no-flash theme script, dark colours.
- `src/pages/questions/[slug].astro` bigger title, `data-pagefind-body`, related questions section.
- `src/components/QuestionList.astro`, `src/pages/index.astro`, `src/pages/category/[category].astro` new typography and dark colours.
- `src/styles/global.css` class-based dark mode, font stack, Pagefind colour tweaks.

### Most important lines
```ts
.filter((q) => q.data.category === current.data.category && q.id !== current.id)
```
Keep a question only if it's in the same category AND isn't the page we're on. Without the second
check, every page would list itself as "related".

```ts
return choices[Math.floor(random() * choices.length)];
```
`random()` gives a number from 0 up to (but not including) 1. Multiplying by the length and rounding
down gives a whole number from 0 to length - 1, which is always a valid index.

```html
<div data-pagefind-body> ... title and short answer ... </div>
```
This attribute is the whole Pagefind setup on our side: once any page has it, Pagefind indexes only
those blocks and skips pages without it (home, categories, search).

### Decisions
- Search covers titles and short answers only (as PLAN.md says), not the full explanation.
- Used Pagefind's newer "Component UI" (recommended since Pagefind 1.5) instead of the older Default UI.
- Related questions: same category only, newest first, at most 3. If there are none yet (right now every
  sample is in a different category) the section is hidden instead of showing an empty box.
- With no saved theme, the site follows the system's light/dark setting.
- No web font download: a system font stack keeps pages fast.

### Practice exercise
Change the related questions limit from 3 to 2: find where `relatedQuestions` is called and pass `2`.
Then add a second physics question (copy `why-is-the-sky-blue.mdx`, change the title and slug),
run `npm run build` and `npm run preview`, and check that each physics page now lists the other one.

### Quiz
1. Why does search work in `npm run preview` but not in `npm run dev`?
2. Why does `pickRandomSlug` take `random` as a parameter instead of calling `Math.random()` directly?

Answers
1. Pagefind builds the search index from `dist/` as the last step of `npm run build`; the dev server never runs Pagefind, so `/pagefind/` doesn't exist there.
2. So tests can pass a fake random function with a known result and check the exact answer, while the browser passes the real `Math.random`.

## Stage 3: Video + interactivity (2026-11-04)

### What we built
- A YouTube embed that shows a lightweight "Play the video" button and only loads the real player when clicked.
  It uses `youtube_id` from the frontmatter and renders nothing when it's empty.
- A reusable `<SliderDemo>` component. The first demo, on "Why is the sky blue?", lets you drag the wavelength
  and shows how many times more it scatters than red light (Rayleigh scattering, 1 / wavelength⁴).
- A `/suggest/` page with a form that sends questions to Formspree, plus a friendly message when it isn't set up.

### New concepts

**Lazy loading ("facade").** A YouTube iframe pulls in roughly a megabyte of scripts, even if nobody presses play.
So we show a cheap stand-in (a button drawn with HTML and a small SVG) and only create the `<iframe>` when it's
clicked. The page stays fast, and YouTube isn't contacted at all for visitors who don't watch.

**youtube-nocookie.com.** This is YouTube's own "privacy-enhanced mode" domain. It plays the same videos, but
doesn't set tracking cookies until the visitor actually plays something.

**MDX components.** MDX is Markdown that can contain components like `<SliderDemo demo="rayleigh" />`. Normally
each file would need an `import` line, but we pass `components={{ SliderDemo }}` to `<Content />` in the
question template, so every question can use it directly.

**Separating data from display.** `SliderDemo.astro` knows nothing about physics: it draws a slider, a bar and a
sentence. Each demo in `src/lib/demos.ts` is a small config object plus one pure `compute` function. That's what
makes the component reusable, and it lets Vitest check the science without a browser.

**The `input` event.** A range slider fires `input` continuously while you drag, and `change` only when you let
go. We listen to `input` so the bar moves with your finger. Slider values arrive as text, so `Number(...)` turns
them into numbers before doing maths.

**Environment variables.** Settings that change between computers (or that you don't want in git) go in
`.env.local`, which is ignored by git. `.env.example` is the committed "blank form" showing which ones exist.
Astro only exposes variables starting with `PUBLIC_` to pages, as a safety net, and reads them at build time.
A Formspree form ID isn't a secret (it's visible in the page's HTML anyway), but keeping it in an env var means
you can change it without editing code.

**Honeypot field.** The form has a hidden `_gotcha` input. People never see it, but spam bots fill every field,
and Formspree throws away any submission where it isn't empty.

**`.refine` in a Zod schema.** `refine` adds your own rule to a field. Here `youtube_id` must be `""` or pass
`isValidYouTubeId`, so pasting a whole URL by mistake stops the build with a readable message.

### No new dependencies
Formspree is a website you post to, not a package. Everything else is plain Astro and browser code.

### Files and what each one does
- `src/lib/youtube.ts` + `youtube.test.ts` checks an ID is 11 valid characters, builds embed and watch URLs.
- `src/lib/demos.ts` + `demos.test.ts` the `DEMOS` list, `rayleighRelativeToRed` and `colourName`.
- `src/lib/formspree.ts` + `formspree.test.ts` turns the form ID into the URL, or `null` if missing/invalid.
- `src/components/YouTubeEmbed.astro` click-to-load video.
- `src/components/SliderDemo.astro` reusable slider, works for any entry in `DEMOS`.
- `src/pages/suggest.astro` the suggest form (or the fallback message).
- `src/env.d.ts` tells TypeScript that `PUBLIC_FORMSPREE_ID` exists.
- `.env.example` the variables to copy into `.env.local`.
- `src/pages/questions/[slug].astro` shows the video and makes `SliderDemo` available to MDX.
- `src/layouts/Base.astro` "Suggest" link in the header and footer.
- `src/content.config.ts` `youtube_id` is now validated.
- `src/content/questions/why-is-the-sky-blue.mdx` uses the slider.

### Most important lines
```ts
return (RED_NM / wavelengthNm) ** 4;
```
Rayleigh scattering goes as 1 / λ⁴. Dividing red's 700 nm by the chosen wavelength and raising it to the 4th power
gives "how many times more than red". At 450 nm that's about 5.9; at 350 nm (half of 700) it's exactly 2⁴ = 16.

```ts
button.replaceWith(iframe);
```
Until this line runs, no YouTube code is on the page. On click we build the iframe and put it exactly where the
button was, inside the same 16:9 box.

```astro
const action = formspreeAction(import.meta.env.PUBLIC_FORMSPREE_ID);
```
Reads the env var at build time. If it gives a URL, the form is drawn with `action={action}`; if it's `null`,
the friendly fallback is drawn instead, so visitors never hit a broken form.

### Decisions
- No video thumbnail: showing YouTube's thumbnail image would contact YouTube before the click. A plain button
  keeps the "nothing loads until you click" promise. (Easy to add later if you want it.)
- The video sits right under the short answer, before the long explanation.
- The form uses a normal HTML POST, so after sending, Formspree shows its own thank-you page. Simplest option,
  and it works without JavaScript.
- Form fields: question (required), name and email (optional).
- Colour bands for the slider use common textbook borders (violet below 450 nm, blue to 495, green to 570,
  yellow to 590, orange to 620, red above). Real colour borders are fuzzy.

### Practice exercise
Add a second demo called `density` to `DEMOS` in `src/lib/demos.ts`: a slider for an object's density
(0.5 to 1.5 g/cm³) whose sentence says "floats" or "sinks" compared to water (1.00 g/cm³). Add a test for it, then put `<SliderDemo demo="density" />` in
`why-does-ice-float.mdx` and check it with `npm run dev`.

### Quiz
1. Why does the page show a button first instead of the YouTube iframe right away?
2. What happens on `/suggest/` if `PUBLIC_FORMSPREE_ID` isn't set, and why must the name start with `PUBLIC_`?

Answers
1. The iframe downloads a lot of YouTube code (and contacts YouTube) even if nobody watches; the button is almost free, and the iframe is created only on click.
2. `formspreeAction` returns `null`, so the page shows the friendly "not open yet" message instead of the form. Astro only exposes variables starting with `PUBLIC_` to page code, so other names would come through as undefined.
