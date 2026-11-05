// Content script for facebook.com.
//
// 1. Opening a Reel ("/reel/123", "/reels/...") shows the friendly blocked page.
//    Unlike Instagram, Facebook has no reliable "normal post" address for a
//    Reel, so we block it instead of converting it.
// 2. Feed posts that link to a Reel (including the "Reels" shelf) are hidden,
//    and so is the "Reels" link in the menu (it points to "/reel/?s=tab").

(function () {
  const { isFacebookReelUrl } = globalThis.ShortsUrl;
  const { start, hideLinks, redirectTo, blockedPageUrl } = globalThis.BlockerCore;

  // Facebook's class names are random letters that change often, so we use
  // the more stable attributes it puts on each feed post. If neither is found
  // (e.g. the menu link), hideLinks hides just the link.
  const POST_SELECTOR = '[data-pagelet^="FeedUnit"], [role="article"]';

  function check() {
    if (isFacebookReelUrl(location.href)) {
      redirectTo(blockedPageUrl());
      return;
    }
    hideLinks('a[href*="/reel"]', isFacebookReelUrl, POST_SELECTOR);
  }

  start('facebook', check);
})();
