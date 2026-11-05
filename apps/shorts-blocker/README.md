# Short-Form Blocker

A Chrome extension that hides short-form video, with one on/off switch per site in its popup (saved with `chrome.storage.sync`, so it survives a browser restart). The popup also shows how many shorts were blocked today and in total.

- **YouTube:** the Shorts shelf, the Shorts sidebar link and channel tab, Shorts in search results and in the "up next" list are hidden, and any `/shorts/ID` link opens in the normal player at `/watch?v=ID`. Works with YouTube in French or any other language.
- **Instagram:** the Reels button and profile Reels tab are hidden, Reels in the feed and Explore are hidden, a `/reel/CODE` link opens as a normal post (`/p/CODE`), and `/reels/` goes back to the home feed.
- **TikTok:** the whole site is replaced by a friendly "go do something else" page.
- **Facebook:** Reels in the feed and the Reels menu link are hidden; opening a Reel shows the friendly page.
- **Snapchat (www.snapchat.com):** links to Spotlight are hidden; opening Spotlight shows the friendly page.

Plain JavaScript, Chrome Manifest V3, no build step. Vitest is used only to test the pure logic (URLs, settings, counter) and to check `manifest.json`. GitHub Actions runs the tests on every push that touches this folder (`.github/workflows/shorts-blocker.yml` at the repo root).

## Load it in Chrome (unpacked extension)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (switch in the top right corner).
3. Click **Load unpacked**.
4. Select the folder `apps/shorts-blocker` (the folder that contains `manifest.json`).
5. The extension appears in the list. Click the puzzle piece icon in the toolbar and pin "Short-Form Blocker" to see its popup.

After you edit any file, go back to `chrome://extensions` and click the round **reload** arrow on the extension's card, then refresh the website's tab. Content scripts only update after both steps.

If something breaks, the extension card shows an **Errors** button. For content script errors, open the website, press F12, and look in the **Console** tab. Each site's rules are in their own files in `sites/`, so if one site changes its layout, only that site's two files need fixing.

## Test it by hand

YouTube:
- Open youtube.com: no Shorts shelf on the home page, no "Shorts" in the left sidebar.
- Search for something popular (e.g. "funny cats"): no Shorts shelf or Shorts cards in the results.
- Paste `https://www.youtube.com/shorts/` followed by any Short's ID in the address bar: it opens as `/watch?v=...`.
- In French: on YouTube, click your profile picture, **Language**, choose **Français**, and repeat the checks above.

Other sites (log in first where needed):
- Instagram: no Reels button in the menu, no Reels posts in the feed; opening `instagram.com/reels/` lands on the home feed; a Reel link a friend sends opens as a normal post.
- TikTok: opening `tiktok.com` shows the "Nothing to swipe here." page.
- Facebook: no Reels shelf or Reels posts in the feed, no Reels link in the menu; opening `facebook.com/reel/` shows the friendly page.
- Snapchat: opening `snapchat.com/spotlight` shows the friendly page.

Switches:
- Click the extension icon, turn off **Instagram Reels**: Reels reappear in the open Instagram tab right away. Turn it back on: they disappear again.
- Turn off **TikTok**, then open `tiktok.com` again: TikTok loads normally.
- Turn one switch off, quit Chrome completely and reopen it: the popup still shows it off.
- The switches are toggles: green with the knob on the right means "blocking on".

Counter and icon:
- The toolbar shows the green "pause" icon, and so does the extension card in `chrome://extensions`.
- Open the popup: **blocked today** and **all time** start at 0.
- Open youtube.com and scroll the home page a bit, then open the popup: the numbers went up (each hidden Short card counts once). Open a `/shorts/ID` link: both go up by 1.
- Open `tiktok.com` (switch on): both go up by 1.
- To check the daily reset: the next day (after midnight on your computer's clock), "blocked today" shows 0 again and "all time" keeps its total.

## Run the tests

```
npm install
npm test
```

## Files

- `manifest.json`: tells Chrome what the extension is, which files to inject on which site, its icons, its background worker, and that it uses `storage`.
- `background.js`: the background service worker; the only file that saves the blocked counter.
- `src/counter.js`: pure "blocked today / all time" logic (local date, daily reset, adding). Tested.
- `src/url-logic.js`: pure functions that recognise Shorts, Reels and Spotlight addresses and build redirect URLs. Tested.
- `src/settings.js`: pure list of sites, their defaults (all on), and helpers to clean up saved settings. Tested.
- `src/blocker-core.js`: shared engine for every site: reads the switch, reacts to changes, watches the page with a MutationObserver, and reports each block to `background.js`.
- `sites/<site>.js` and `sites/<site>.css`: what to hide or redirect on one site (youtube, instagram, tiktok, facebook, snapchat).
- `blocked/`: the friendly page shown instead of TikTok, Facebook Reels and Snapchat Spotlight.
- `popup/`: the window with the counter and the on/off switches.
- `icons/`: the icon in 16, 32, 48 and 128 pixels.
- `scripts/make-icons.js`: redraws the icons (`node scripts/make-icons.js`), only needed if you change the design. Uses no library.
- `tests/`: Vitest tests for `url-logic.js`, `settings.js`, `counter.js`, and checks on `manifest.json`.
