// Content script for tiktok.com.
// TikTok is short videos and nothing else, so there's nothing to "keep usable":
// while the switch is on, the whole site is replaced by our friendly page.

(function () {
  const { start, blockedPageUrl } = globalThis.BlockerCore;

  function check() {
    location.replace(blockedPageUrl());
  }

  start('tiktok', check);
})();
