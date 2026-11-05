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

## Stage 2: Other sites + settings (2026-11-04)

### What we built
The blocker now works on five sites, and the popup has one on/off switch per site. Instagram loses its Reels button and Reels posts, and a Reel link opens as a normal post. TikTok is replaced by a friendly "Nothing to swipe here." page. Facebook Reels and Snapchat Spotlight are hidden from the feed and their pages show that same friendly page. Your switches are saved with `chrome.storage.sync`, so they survive a restart, and they apply instantly to tabs that are already open. YouTube now also works when it's displayed in French. The new URL and settings logic has 18 new tests (29 in total).

### New concepts

**`chrome.storage.sync`.** A small key/value storage that Chrome gives extensions. Unlike a normal variable, it's still there after you close Chrome, and if you're signed into Chrome with sync on, it follows you to your other computers. It's asynchronous: `chrome.storage.sync.get(key, callback)` doesn't return the answer, it calls your function later with it. That's why our code "assumes on" for a split second until the answer arrives.

**Permissions.** Extensions must declare in `manifest.json` which Chrome features they use. `"permissions": ["storage"]` is what unlocks `chrome.storage`. Asking only for what you need is good practice: users (and the Chrome Web Store) are suspicious of extensions that ask for a lot.

**Events across tabs (`chrome.storage.onChanged`).** When the popup saves a setting, Chrome tells every content script that is listening, in every open tab. Our scripts react by adding or removing one attribute on `<html>`, so a switch works immediately without reloading.

**One attribute to switch all the CSS.** Content-script CSS from the manifest can't be turned off by JavaScript. So every rule starts with `html[data-shorts-blocker="on"]`: "only when `<html>` has this attribute". Removing that single attribute makes all the rules stop matching at once.

**Sharing code between sites (a small "engine").** All five sites need the same plumbing: read the switch, listen for changes, watch the page. Instead of copying it five times, it lives once in `src/blocker-core.js`, and each `sites/*.js` file only says what is special about its site (a `check` function). If Facebook changes its layout, you only open `sites/facebook.js` and `sites/facebook.css`.

**`web_accessible_resources`.** Files inside an extension are private by default: a website tab can't open them. Listing `blocked/blocked.html` there (only for TikTok, Facebook and Snapchat) lets those tabs navigate to our friendly page with `chrome.runtime.getURL(...)`, which turns a file path into its full `chrome-extension://...` address.

**Language-independent selectors.** Matching the visible word "Shorts" breaks when the page is in another language. Matching what doesn't get translated is safer: tag names (`ytd-reel-shelf-renderer`), and link addresses (`a[href^="/shorts"]`, `a[href$="/reels/"]`). `^=` means "starts with", `$=` "ends with", `*=` "contains", and an `i` before `]` makes the comparison ignore upper/lower case.

**Defaults and "cleaning" saved data.** The first time the extension runs, storage is empty, and if we add a sixth site later, old saved settings won't mention it. `withDefaults` handles both: start from the defaults, then copy over only valid saved values. Code that reads saved data should never trust it blindly.

### Files changed
- `manifest.json`: version 0.2.0, `storage` permission, one content-script entry per site, `web_accessible_resources` for the friendly page.
- `src/url-logic.js`: added `getInstagramReelCode`, `instagramRedirectUrl`, `isFacebookReelUrl`, `isSnapchatSpotlightUrl`.
- `src/settings.js` (new): the site list, `DEFAULT_SETTINGS`, `withDefaults`, `isSiteEnabled`, `setSiteEnabled`.
- `src/blocker-core.js` (new): shared engine (`start`, `hideLinks`, `blockedPageUrl`).
- `sites/youtube.js`, `sites/youtube.css` (moved from `src/`): now use the engine; CSS scoped to the on/off attribute and given language-independent selectors.
- `sites/instagram.*`, `sites/tiktok.*`, `sites/facebook.*`, `sites/snapchat.*` (new): each site's rules.
- `blocked/blocked.html`, `blocked/blocked.css` (new): the friendly page.
- `popup/popup.html`, `popup/popup.js` (new), `popup/popup.css`: the switches.
- `tests/url-logic.test.js`: tests for the new URL functions. `tests/settings.test.js` (new): tests for settings.
- `README.md`: new sites, hand tests for switches and French YouTube, new file list.

### Most important lines
```js
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes[STORAGE_KEY]) {
    apply(changes[STORAGE_KEY].newValue);
  }
});
```
"Whenever saved settings change, re-apply them on this page." `changes` only contains the keys that changed, and `newValue` is what was just saved. This is why flipping a switch in the popup works instantly.

```js
if (!isMatch(link.href)) continue;
const box = (containerSelector && link.closest(containerSelector)) || link;
```
The CSS selector is a fast but rough filter; `isMatch` is the precise, tested answer. Then `||` means "use the post around the link if there is one, otherwise the link itself".

```css
html[data-shorts-blocker="on"] a[href$="/reels/"] { display: none !important; }
```
Hide every link ending in `/reels/`, but only while the switch is on.

### Decisions
- **French YouTube:** YouTube keeps the name "Shorts" untranslated in French, so Stage 1 already worked there. To be safe in every language, I added address-based rules (`a[href^="/shorts"]`, `a[href$="/shorts"]`) and kept the label rules as backups, now case-insensitive.
- **Instagram Reels open as posts** (`/p/CODE/`), like YouTube Shorts open in the normal player: you can still watch what a friend sent, without the endless swipe. **Facebook and Snapchat** don't have a reliable "normal" address for a Reel/Spotlight, so those pages show the friendly page instead.
- **One friendly page for every blocked site**, with no JavaScript, because it's simpler and MV3 doesn't allow inline scripts anyway.
- **All settings are stored under one key** (`enabledSites`) as one object, which is simpler to read and save than five separate keys.
- **Snapchat:** only `www.snapchat.com` (where Spotlight is). `web.snapchat.com` is for chatting and is left alone.
- **TikTok switched off later:** the friendly page can't bring TikTok back by itself; you turn off the switch and open TikTok again (the page says so).
- I couldn't test on the real sites from here: the selectors for Instagram, Facebook and Snapchat are based on their link addresses, which change less often than their layout, but check them by hand with the README steps.

### Practice exercise
Add a sixth site yourself, for example X/Twitter videos or another site you scroll too much. Add it to `SITES` in `src/settings.js`, create `sites/<name>.js` and `sites/<name>.css` by copying `sites/snapchat.*`, and add a content-script entry in `manifest.json`. Run `npm test`: the `DEFAULT_SETTINGS` test will fail because the list changed. Read the error and update the test. Then reload the extension and check the new switch appears in the popup.

### Quiz
1. Why does every CSS rule in `sites/` start with `html[data-shorts-blocker="on"]`?
2. Why is `a[href$="/reels/"]` better than looking for a button with the text "Reels"?

Answers

1. CSS injected by the manifest can't be switched off by JavaScript. Scoping every rule to that attribute means `blocker-core.js` can turn all the hiding on or off by adding or removing one attribute on `<html>`.
2. The text changes with the language (and Instagram can rename the button), but the link address stays the same in every language.
