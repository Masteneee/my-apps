# LEARNING.md: Short-Form Blocker

## Stage 1: Skeleton + YouTube (2026-11-04)

### What we built
A Chrome extension that runs on YouTube. It hides every Shorts section you normally see (home shelf, sidebar link, search results, "up next" list, channel Shorts tab) and turns any `/shorts/ID` page into the normal video player at `/watch?v=ID`. Clicking the extension icon opens a small popup that says it is active. The URL logic lives in its own file and has 11 automated tests.

### New concepts

**Chrome extension and manifest.json.** An extension is just a folder of HTML, CSS and JavaScript files. `manifest.json` is its ID card: it tells Chrome the name, the version of the extension system (Manifest V3 is the current one), and which files to run on which websites. Chrome reads it first, so if it has a typo, nothing loads.

**Content script.** A JavaScript file Chrome injects into a web page you visit, as if the website had included it itself. It can read and change the page's HTML (the DOM), but it can't see the website's own JavaScript variables. Ours is `src/youtube.js`, and `"matches"` in the manifest limits it to YouTube.

**The DOM.** When a browser loads HTML, it turns it into a tree of objects you can work with from JavaScript, called the DOM (Document Object Model). `document.querySelectorAll('a')` finds every link in that tree, and `element.closest('ytd-video-renderer')` walks up the tree to find the box that contains an element. Changing the DOM changes what you see on screen.

**MutationObserver.** YouTube doesn't load one finished page: it keeps adding videos as you scroll and swaps content when you click, without reloading. A script that runs once at the start would miss all of that. A `MutationObserver` is a built-in browser tool that you give a function to, and it calls that function every time the HTML inside the element you're watching changes. We watch the whole page (`subtree: true`) and re-check for Shorts each time.

**Throttling (one check per frame).** While YouTube loads, the page can change hundreds of times per second, and re-scanning the page every single time would make it laggy. So we use a flag (`checkScheduled`) and `requestAnimationFrame`: the first change books one check for the next screen refresh, and all other changes before then are ignored because a check is already booked.

**CSS selectors with `:has()`.** A selector is the "address" CSS uses to find elements, like `ytd-reel-shelf-renderer` (a tag YouTube invented) or `[aria-label="Shorts"]` (an attribute). `:has(...)` means "an element that contains ...", so `ytd-guide-entry-renderer:has(a[title="Shorts"])` hides the sidebar entry holding the Shorts link. CSS applies before JavaScript runs, so these sections never flash on screen.

**Pure functions and unit tests.** A pure function only takes inputs and returns an output: no page, no network, no Chrome. `shortsToWatchUrl('/shorts/abc...')` always gives the same answer, so we can check it automatically with Vitest, which runs in Node without a browser. That's why the URL logic is separated from the DOM code.

**`globalThis` and `module.exports`.** Chrome content scripts are "classic" scripts, which can't use `import`/`export`. So `url-logic.js` puts its functions on `globalThis` (the shared global object, so `youtube.js` can use them) and also on `module.exports` (so Vitest can import them). The manifest loads `url-logic.js` before `youtube.js`, which is why the order in `"js": [...]` matters.

### New dependency
**Vitest** (dev dependency only, never shipped in the extension). It runs our tests with `npm test`. It saves real work because it gives readable failure messages and `expect(...).toBe(...)` checks for free. I installed version 5 because older versions have known security issues reported by `npm audit`.

### Files changed
- `manifest.json`: extension settings; injects `url-logic.js`, `youtube.js` and `youtube.css` on YouTube and sets the popup.
- `src/url-logic.js`: `getShortsId`, `isShortsUrl`, `shortsToWatchUrl` (pure functions).
- `src/youtube.js`: redirect plus hiding cards that link to Shorts, using a MutationObserver.
- `src/youtube.css`: hides known Shorts sections by their YouTube tag names.
- `popup/popup.html`, `popup/popup.css`: the popup window.
- `tests/url-logic.test.js`: 11 tests for the URL logic.
- `package.json`, `package-lock.json`: Vitest and the `npm test` script.
- `.gitignore`: keeps `node_modules/` out of git.
- `README.md`: how to load the extension, test it by hand, run tests.

### Most important lines
```js
const observer = new MutationObserver(scheduleCheck);
observer.observe(document.documentElement, { childList: true, subtree: true });
```
"Call `scheduleCheck` whenever elements are added or removed anywhere inside `<html>`." `childList` means "added/removed children", `subtree` means "at any depth, not only direct children".

```js
location.replace(watchUrl);
```
Goes to the normal player. `replace` (instead of `location.href = ...`) swaps the current history entry, so pressing Back doesn't drop you into the Short and redirect you again in a loop.

### Decisions
- Stage 1's popup only shows a status message; the on/off switches belong to Stage 2.
- Shorts redirect is done in the content script (not with `declarativeNetRequest` rules), because one place for all YouTube logic is simpler to understand and covers in-page navigation too.
- Hidden elements get a `data-shorts-blocker-hidden` attribute instead of being deleted, because YouTube's own code can crash or re-add elements it expects to find.

### Practice exercise
YouTube also shows a "Shorts" filter chip at the top of search results. Find it yourself: search something on YouTube, right-click the "Shorts" chip, choose **Inspect**, and look at its tag name and attributes in the Elements panel. Then add one selector for it in `src/youtube.css`, reload the extension, and check the chip is gone. Bonus: add a test in `tests/url-logic.test.js` checking that `isShortsUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ?t=5')` is `true`.

### Quiz
1. Why wouldn't hiding Shorts once, when the page first loads, be enough on YouTube?
2. Why does `url-logic.js` have to be listed before `youtube.js` in `manifest.json`?

Answers

1. YouTube adds new content as you scroll and when you navigate without a full reload, so new Shorts would appear after the first check. The MutationObserver re-checks on every change.
2. Chrome runs the files in the listed order. `youtube.js` reads `globalThis.ShortsUrl`, which only exists after `url-logic.js` has run.
