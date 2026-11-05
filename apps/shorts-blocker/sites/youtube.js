// Content script for youtube.com.
// Runs after src/url-logic.js, src/settings.js and src/blocker-core.js
// (see manifest.json), so ShortsUrl and BlockerCore already exist.
//
// Two jobs:
//   1. Redirect /shorts/ID to /watch?v=ID (the normal player, no endless swipe).
//   2. Hide any video card that links to a Short. youtube.css already hides the
//      known Shorts sections; this catches single Shorts mixed into normal lists.
// Both only happen while the YouTube switch in the popup is on.

(function () {
  const { isShortsUrl, shortsToWatchUrl } = globalThis.ShortsUrl;
  const { start, hideLinks, redirectTo } = globalThis.BlockerCore;

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

  function check() {
    const watchUrl = shortsToWatchUrl(location.href);
    if (watchUrl) {
      // redirectTo uses location.replace(), so Back doesn't loop into the Short.
      redirectTo(watchUrl);
      return;
    }
    // Matching links by their address instead of their text ("Shorts") works
    // in every language YouTube is shown in, French included.
    hideLinks('a[href*="/shorts/"]', isShortsUrl, VIDEO_CARD_SELECTOR);
  }

  const { scheduleCheck } = start('youtube', check);

  // YouTube fires this custom event after it finishes an in-page navigation.
  document.addEventListener('yt-navigate-finish', scheduleCheck);
})();
