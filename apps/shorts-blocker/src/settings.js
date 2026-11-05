// Pure settings logic: which sites exist, their default on/off state, and how
// to clean up whatever we read back from chrome.storage.
// No chrome.* calls here, so Vitest can test it. Same globalThis/module.exports
// trick as url-logic.js (see the comment at the top of that file).

(function () {
  // The order here is the order of the switches in the popup.
  const SITES = [
    { id: 'youtube', label: 'YouTube Shorts' },
    { id: 'instagram', label: 'Instagram Reels' },
    { id: 'tiktok', label: 'TikTok (whole site)' },
    { id: 'facebook', label: 'Facebook Reels' },
    { id: 'snapchat', label: 'Snapchat Spotlight' },
  ];

  // All settings live under this one key in chrome.storage.sync.
  const STORAGE_KEY = 'enabledSites';

  // Every site starts ON: you installed a blocker, so it should block.
  const DEFAULT_SETTINGS = Object.freeze(
    Object.fromEntries(SITES.map((site) => [site.id, true]))
  );

  // Takes whatever was stored (maybe nothing, maybe an old version, maybe junk)
  // and returns a complete, clean object with one true/false per known site.
  // Why: the first time the extension runs, storage is empty; and if we add a
  // new site later, old saved settings won't have it yet. Both get the default.
  function withDefaults(stored) {
    const result = { ...DEFAULT_SETTINGS };
    if (!stored || typeof stored !== 'object') return result;
    for (const site of SITES) {
      if (typeof stored[site.id] === 'boolean') result[site.id] = stored[site.id];
    }
    return result;
  }

  // True if blocking is on for this site. Unknown sites are never blocked.
  function isSiteEnabled(settings, siteId) {
    if (!(siteId in DEFAULT_SETTINGS)) return false;
    return withDefaults(settings)[siteId];
  }

  // Returns a NEW settings object with one site changed. We don't modify the
  // old object, so nothing else that holds a reference to it changes by surprise.
  function setSiteEnabled(settings, siteId, enabled) {
    const next = withDefaults(settings);
    if (siteId in DEFAULT_SETTINGS) next[siteId] = Boolean(enabled);
    return next;
  }

  const BlockerSettings = {
    SITES,
    STORAGE_KEY,
    DEFAULT_SETTINGS,
    withDefaults,
    isSiteEnabled,
    setSiteEnabled,
  };

  globalThis.BlockerSettings = BlockerSettings;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlockerSettings;
  }
})();
