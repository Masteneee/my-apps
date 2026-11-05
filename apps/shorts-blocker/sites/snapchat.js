// Content script for www.snapchat.com.
// Opening Spotlight ("/spotlight", "/@user/spotlight/ID") shows the friendly
// blocked page, and links to Spotlight are hidden everywhere else.

(function () {
  const { isSnapchatSpotlightUrl } = globalThis.ShortsUrl;
  const { start, hideLinks, blockedPageUrl } = globalThis.BlockerCore;

  function check() {
    if (isSnapchatSpotlightUrl(location.href)) {
      location.replace(blockedPageUrl());
      return;
    }
    // No container: Snapchat's page has no stable "card" element, so we hide
    // just the link (which is usually the whole tile anyway).
    hideLinks('a[href*="/spotlight"]', isSnapchatSpotlightUrl, null);
  }

  start('snapchat', check);
})();
