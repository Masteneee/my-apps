// Content script for youtube.com.
// Chrome injects this file into every YouTube page (see manifest.json).
// It runs AFTER src/url-logic.js, so the global `ShortsUrl` already exists.
//
// Two jobs:
//   1. Redirect /shorts/ID to /watch?v=ID (the normal player, no endless swipe).
//   2. Hide any video card that links to a Short. youtube.css already hides the
//      known Shorts sections; this catches single Shorts mixed into normal lists.

(function () {
  const { isShortsUrl, shortsToWatchUrl } = globalThis.ShortsUrl;

  // The attribute youtube.css uses to hide things. Using an attribute instead of
  // removing elements means YouTube's own code doesn't crash looking for them.
  const HIDDEN_ATTR = 'data-shorts-blocker-hidden';

  // The "card" elements YouTube wraps around one video. When a card links to a
  // Short, we hide the whole card, not just the link, so no empty box is left.
  const VIDEO_CARD_SELECTOR = [
    'ytd-rich-item-renderer', // home page grid
    'ytd-video-renderer', // search results
    'ytd-grid-video-renderer', // channel pages
    'ytd-compact-video-renderer', // "up next" sidebar on a watch page
    'ytd-reel-item-renderer',
    'yt-lockup-view-model', // newer card layout
    'ytm-shorts-lockup-view-model',
    'ytm-video-with-context-renderer', // m.youtube.com
  ].join(',');

  // --- Job 1: redirect ---------------------------------------------------
  function redirectIfShorts() {
    const watchUrl = shortsToWatchUrl(location.href);
    if (watchUrl) {
      // replace() instead of assigning location.href, so the Back button
      // doesn't bounce you straight back into the Short.
      location.replace(watchUrl);
    }
  }

  // --- Job 2: hide cards that link to Shorts --------------------------------
  function hideShortsCards() {
    // Only links whose href contains "/shorts/" are candidates; isShortsUrl
    // then double-checks it's a real Short (valid 11-character ID).
    const links = document.querySelectorAll('a[href*="/shorts/"]');
    for (const link of links) {
      if (!isShortsUrl(link.getAttribute('href'))) continue;
      const card = link.closest(VIDEO_CARD_SELECTOR);
      if (card && !card.hasAttribute(HIDDEN_ATTR)) {
        card.setAttribute(HIDDEN_ATTR, '');
      }
    }
  }

  // YouTube is a "single-page app": clicking a video changes the URL without
  // loading a new page, and new videos keep appearing as you scroll. So we
  // can't just run once. A MutationObserver calls us back whenever the page's
  // HTML changes.
  //
  // The page can change hundreds of times per second while loading, so we
  // bundle all those changes into one check per animation frame (~60 per second
  // max) instead of re-scanning the page for every single change.
  let checkScheduled = false;
  function scheduleCheck() {
    if (checkScheduled) return;
    checkScheduled = true;
    requestAnimationFrame(() => {
      checkScheduled = false;
      redirectIfShorts();
      hideShortsCards();
    });
  }

  // Run once right away (catches a Shorts link opened in a new tab).
  redirectIfShorts();

  const observer = new MutationObserver(scheduleCheck);
  // We run at "document_start", when only <html> exists, so we watch it.
  // subtree: true means "also tell me about changes deep inside it".
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // YouTube fires this custom event after it finishes an in-page navigation.
  document.addEventListener('yt-navigate-finish', scheduleCheck);
  // Back/forward buttons.
  window.addEventListener('popstate', scheduleCheck);
})();
