// Content script for tiktok.com.
// TikTok is short videos and nothing else, so there's nothing to "keep usable":
// while the switch is on, the whole site is replaced by our friendly page.

(function () {
  const { start, redirectTo, blockedPageUrl } = globalThis.BlockerCore;

  function check() {
    redirectTo(blockedPageUrl());
  }

  start('tiktok', check);
})();
