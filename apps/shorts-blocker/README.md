# Short-Form Blocker

A Chrome extension that hides short-form video. Stage 1 covers YouTube: the Shorts shelf, the Shorts sidebar link, Shorts in search results and in the "up next" list are hidden, and any `/shorts/ID` link opens in the normal player at `/watch?v=ID`.

Plain JavaScript, Chrome Manifest V3, no build step. Vitest is used only to test the URL logic.

## Load it in Chrome (unpacked extension)

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (switch in the top right corner).
3. Click **Load unpacked**.
4. Select the folder `apps/shorts-blocker` (the folder that contains `manifest.json`).
5. The extension appears in the list. Click the puzzle piece icon in the toolbar and pin "Short-Form Blocker" to see its popup.

After you edit any file, go back to `chrome://extensions` and click the round **reload** arrow on the extension's card, then refresh your YouTube tab. Content scripts only update after both steps.

If something breaks, the extension card shows an **Errors** button. For content script errors, open YouTube, press F12, and look in the **Console** tab.

## Test it by hand

- Open youtube.com: no Shorts shelf on the home page, no "Shorts" in the left sidebar.
- Search for something popular (e.g. "funny cats"): no Shorts shelf or Shorts cards in the results.
- Paste `https://www.youtube.com/shorts/` followed by any Short's ID in the address bar: it opens as `/watch?v=...`.
- Click the extension icon: the popup says it is active on YouTube.

## Run the tests

```
npm install
npm test
```

## Files

- `manifest.json`: tells Chrome what the extension is and which files to inject where.
- `src/url-logic.js`: pure functions that detect Shorts URLs and build the `/watch` URL. Tested.
- `src/youtube.js`: content script that redirects Shorts and hides cards linking to Shorts.
- `src/youtube.css`: hides the known Shorts sections instantly.
- `popup/`: the small window that opens when you click the extension icon.
- `tests/url-logic.test.js`: Vitest tests for `url-logic.js`.
