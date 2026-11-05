// Content script for instagram.com. Loaded after the shared files (manifest.json).
//
// 1. A single Reel ("/reel/CODE/") opens as a normal post ("/p/CODE/"), and the
//    Reels feed ("/reels/") goes back to the home feed.
// 2. Posts in the feed and tiles in Explore that link to a Reel are hidden.
// instagram.css hides the "Reels" button in the menu and on profiles.

(function () {
  const { instagramRedirectUrl, getInstagramReelCode } = globalThis.ShortsUrl;
  const { start, hideLinks, redirectTo } = globalThis.BlockerCore;

  // A feed post is an <article>. In Explore and on profiles there's no
  // <article>, so hideLinks falls back to hiding the tile (the link) itself.
  const POST_SELECTOR = 'article';

  function check() {
    const target = instagramRedirectUrl(location.href);
    if (target) {
      redirectTo(target);
      return;
    }
    hideLinks('a[href*="/reel/"]', (href) => getInstagramReelCode(href) !== null, POST_SELECTOR);
  }

  start('instagram', check);
})();
