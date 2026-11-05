// Shared engine for every site's content script (sites/*.js).
// Each site only describes WHAT to block; this file handles the parts that are
// the same everywhere: reading the on/off switch, reacting when you flip it in
// the popup, and re-checking the page when it changes (MutationObserver).
//
// Loaded after src/url-logic.js and src/settings.js (see manifest.json).

(function () {
  const { STORAGE_KEY, isSiteEnabled } = globalThis.BlockerSettings;

  // Put on <html> while blocking is on. Every rule in sites/*.css starts with
  // html[data-shorts-blocker="on"], so removing this one attribute instantly
  // un-hides everything when you switch a site off in the popup.
  const ACTIVE_ATTR = 'data-shorts-blocker';

  // Put on single elements that a site script decided to hide.
  const HIDDEN_ATTR = 'data-shorts-blocker-hidden';

  // The friendly "go do something else" page, packaged inside the extension.
  function blockedPageUrl() {
    return chrome.runtime.getURL('blocked/blocked.html');
  }

  // Tells background.js that `amount` more shorts were blocked, for the
  // "blocked today / all time" counter in the popup.
  function reportBlocked(amount) {
    if (amount <= 0) return;
    try {
      // .catch: if the extension was just reloaded, this old tab can't reach it
      // anymore. Missing one count is fine; crashing the page script isn't.
      chrome.runtime.sendMessage({ type: 'blocked', amount }).catch(() => {});
    } catch {
      // Same reason as above, for older Chrome versions that throw instead.
    }
  }

  // Hides every link that passes `isMatch`, or the box around it.
  // - linkSelector: a quick CSS pre-filter, e.g. 'a[href*="/reel/"]'
  // - isMatch: a tested function from url-logic.js that gives the real answer
  // - containerSelector: the "card" to hide; if none is found, hide the link
  // Only boxes hidden for the FIRST time are counted, so the same Short isn't
  // counted again every time the page changes.
  function hideLinks(linkSelector, isMatch, containerSelector) {
    let newlyHidden = 0;
    for (const link of document.querySelectorAll(linkSelector)) {
      // link.href is always the full URL, even if the HTML says "/reel/abc".
      if (!isMatch(link.href)) continue;
      const box = (containerSelector && link.closest(containerSelector)) || link;
      if (!box.hasAttribute(HIDDEN_ATTR)) {
        box.setAttribute(HIDDEN_ATTR, '');
        newlyHidden++;
      }
    }
    reportBlocked(newlyHidden);
  }

  // Leaves a short-video page (counts as one block).
  // The page keeps running for a moment after location.replace(), and the
  // MutationObserver can call check() again during that time. The flag makes
  // sure we redirect, and count, only once.
  let redirecting = false;
  function redirectTo(url) {
    if (redirecting) return;
    redirecting = true;
    reportBlocked(1);
    // replace() instead of assigning location.href, so the Back button
    // doesn't bounce you straight back into the short video.
    location.replace(url);
  }

  // site: an ID from settings.js ("youtube", "instagram", ...)
  // check: the site's function that redirects and hides things on the page
  function start(site, check) {
    // We don't know the saved setting yet (reading storage takes a moment),
    // so we assume ON for the CSS. That way nothing flashes on screen if the
    // site is blocked, which is the normal case. JS checks (like redirects)
    // wait until we really know.
    let enabled = null; // null = "not loaded yet"
    document.documentElement.setAttribute(ACTIVE_ATTR, 'on');

    function apply(settings) {
      enabled = isSiteEnabled(settings, site);
      if (enabled) {
        document.documentElement.setAttribute(ACTIVE_ATTR, 'on');
        scheduleCheck();
      } else {
        document.documentElement.removeAttribute(ACTIVE_ATTR);
      }
    }

    // Same "one check per frame" throttle as Stage 1, now shared by all sites.
    let checkScheduled = false;
    function scheduleCheck() {
      if (!enabled || checkScheduled) return;
      checkScheduled = true;
      requestAnimationFrame(() => {
        checkScheduled = false;
        if (!enabled) return;
        // Some sites rewrite <html>'s attributes; put ours back if it vanished.
        if (!document.documentElement.hasAttribute(ACTIVE_ATTR)) {
          document.documentElement.setAttribute(ACTIVE_ATTR, 'on');
        }
        check();
      });
    }

    // Read the saved switches. chrome.storage.sync keeps them after a browser
    // restart (and across your Chrome profiles if sync is on).
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      apply(result[STORAGE_KEY]);
    });

    // Fires in every open tab when the popup saves a change, so flipping a
    // switch works right away, without reloading the page.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes[STORAGE_KEY]) {
        apply(changes[STORAGE_KEY].newValue);
      }
    });

    const observer = new MutationObserver(scheduleCheck);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('popstate', scheduleCheck);

    // Returned so a site can trigger a check from its own events.
    return { scheduleCheck };
  }

  globalThis.BlockerCore = { start, hideLinks, redirectTo, blockedPageUrl, HIDDEN_ATTR };
})();
