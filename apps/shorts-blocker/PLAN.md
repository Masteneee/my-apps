# PLAN.md: Short-Form Blocker (Chrome extension)

## Goal
A Chrome extension that hides short-form video everywhere (YouTube Shorts, Instagram Reels, TikTok, Facebook Reels, Snapchat Spotlight) while leaving normal content usable.

## Why this first
It's small, needs no server and no database, and you can use it the same day. It teaches HTML, CSS, JavaScript and how the DOM works.

## Stack (overrides CLAUDE.md default)
- Plain JavaScript, Chrome Manifest V3. No framework, no build step.
- Vitest only for the pure logic (URL matching).

## Scope
In: hiding Shorts/Reels sections and links, redirecting direct Shorts URLs, an on/off switch per site, a counter of "shorts blocked".
Out: Firefox/Safari, accounts, syncing, Chrome Web Store publishing (do that by hand later).

## Stages

### Stage 1: Skeleton + YouTube
- `manifest.json`, a content script, and a popup.
- On youtube.com: hide the Shorts shelf, the Shorts sidebar link, and Shorts in search results. Redirect `/shorts/ID` to `/watch?v=ID`.
- Use a MutationObserver, since YouTube loads content dynamically. Explain what that is in LEARNING.md.
- README: how to load an unpacked extension in Chrome.
- Done when: browsing YouTube shows no Shorts anywhere I normally see them.

### Stage 2: Other sites + settings
- Instagram (Reels tab, Reels in feed), TikTok (block the whole site with a friendly "go do something else" page), Facebook Reels, Snapchat Spotlight.
- Keep each site's rules in its own file under `sites/` so a broken site is easy to fix.
- Popup: on/off toggle per site, saved with `chrome.storage.sync`.
- Done when: each toggle works and survives a browser restart.

### Stage 3: Polish + tests
- "Blocked today / all time" counter in the popup.
- Unit tests for URL matching and redirect logic.
- GitHub Actions running the tests.
- A clean popup design and an icon.
- LEARNING.md section: "What to do when a site changes its layout and the blocker breaks" (how to inspect elements and update a selector yourself).

## Kickoff prompt
```
Read CLAUDE.md and PLAN.md. Do Stage 1 only. Start with a short plan,
then build it, commit and push. Update LEARNING.md.
```
