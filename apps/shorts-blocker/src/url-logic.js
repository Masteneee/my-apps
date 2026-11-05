// Pure URL logic for YouTube Shorts.
// "Pure" means: no DOM, no chrome.* APIs, no side effects. Text goes in, an
// answer comes out. That is what makes this file easy to unit test with Vitest.
//
// Why no `export` keyword? Chrome content scripts are loaded as classic scripts,
// not ES modules, so `export` would be a syntax error there. Instead we attach the
// functions to `globalThis` (for the extension) and to `module.exports` (for Vitest).

(function () {
  // YouTube video IDs are 11 characters made of letters, digits, "-" and "_".
  const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

  const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com'];

  // Turns any string into a URL object, or null if it can't be parsed.
  // The base lets relative links like "/shorts/abc" work too.
  function toUrl(input) {
    if (typeof input !== 'string' || input.trim() === '') return null;
    try {
      return new URL(input, 'https://www.youtube.com');
    } catch {
      return null;
    }
  }

  // Returns the video ID from a Shorts URL, or null if it isn't one.
  // Example: "https://www.youtube.com/shorts/dQw4w9WgXcQ" -> "dQw4w9WgXcQ"
  function getShortsId(input) {
    const url = toUrl(input);
    if (!url || !YOUTUBE_HOSTS.includes(url.hostname)) return null;

    // pathname looks like "/shorts/ID" (sometimes with a trailing slash).
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length !== 2 || parts[0] !== 'shorts') return null;

    const id = parts[1];
    return VIDEO_ID_PATTERN.test(id) ? id : null;
  }

  // True if the URL (full or relative) points to a single Short.
  function isShortsUrl(input) {
    return getShortsId(input) !== null;
  }

  // "/shorts/ID" -> "https://<same host>/watch?v=ID", or null if not a Short.
  // We keep the same host so m.youtube.com stays on mobile.
  function shortsToWatchUrl(input) {
    const id = getShortsId(input);
    if (!id) return null;
    const host = toUrl(input).hostname;
    return `https://${host}/watch?v=${id}`;
  }

  const ShortsUrl = { getShortsId, isShortsUrl, shortsToWatchUrl };

  // For the extension: youtube.js reads this global.
  globalThis.ShortsUrl = ShortsUrl;

  // For Vitest (Node): only exists when loaded as a CommonJS module.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShortsUrl;
  }
})();
