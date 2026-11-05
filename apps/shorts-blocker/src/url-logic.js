// Pure URL logic for every site the extension supports.
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

  // ---------------------------------------------------------------------------
  // Other sites (Stage 2)
  // ---------------------------------------------------------------------------

  // The main domain of each site. "Ends with .facebook.com" covers www., m.
  // and any other subdomain, without matching a lookalike like "notfacebook.com".
  const SITE_DOMAINS = {
    instagram: 'instagram.com',
    facebook: 'facebook.com',
    snapchat: 'snapchat.com',
  };

  function hostIsOn(hostname, domain) {
    return hostname === domain || hostname.endsWith('.' + domain);
  }

  // Splits the path of a URL into its pieces: "/reel/abc/" -> ["reel", "abc"].
  // `baseUrl` lets relative links from the page ("/reel/abc") work too.
  function pathParts(input, baseUrl) {
    if (typeof input !== 'string' || input.trim() === '') return null;
    try {
      const url = new URL(input, baseUrl);
      return { url, parts: url.pathname.split('/').filter(Boolean) };
    } catch {
      return null;
    }
  }

  // Instagram post/reel codes are letters, digits, "-" and "_".
  const INSTAGRAM_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

  // Returns the code of a single Reel, or null.
  // Reels show up as "/reel/CODE/", "/reels/CODE/" and "/username/reel/CODE/".
  function getInstagramReelCode(input) {
    const parsed = pathParts(input, 'https://www.instagram.com');
    if (!parsed || !hostIsOn(parsed.url.hostname, SITE_DOMAINS.instagram)) return null;
    const p = parsed.parts;
    let code = null;
    if ((p[0] === 'reel' || p[0] === 'reels') && p.length === 2) code = p[1];
    if (p[1] === 'reel' && p.length === 3) code = p[2];
    return code && INSTAGRAM_CODE_PATTERN.test(code) ? code : null;
  }

  // Where to send an Instagram Reels page instead, or null to stay.
  // A single Reel opens as a normal post ("/p/CODE/"): you can still watch what
  // a friend sent you, but there's no endless swipe to the next one.
  // The Reels feed itself ("/reels/") goes back to the home feed.
  function instagramRedirectUrl(input) {
    const code = getInstagramReelCode(input);
    if (code) return `https://www.instagram.com/p/${code}/`;
    const parsed = pathParts(input, 'https://www.instagram.com');
    if (!parsed || !hostIsOn(parsed.url.hostname, SITE_DOMAINS.instagram)) return null;
    if (parsed.parts.length === 1 && parsed.parts[0] === 'reels') {
      return 'https://www.instagram.com/';
    }
    return null;
  }

  // True for Facebook Reels pages: "/reel/123", "/reel/?s=tab", "/reels/...".
  function isFacebookReelUrl(input) {
    const parsed = pathParts(input, 'https://www.facebook.com');
    if (!parsed || !hostIsOn(parsed.url.hostname, SITE_DOMAINS.facebook)) return false;
    const first = parsed.parts[0];
    return first === 'reel' || first === 'reels';
  }

  // True for Snapchat Spotlight pages: "/spotlight", "/spotlight/ID",
  // and "/@username/spotlight/ID".
  function isSnapchatSpotlightUrl(input) {
    const parsed = pathParts(input, 'https://www.snapchat.com');
    if (!parsed || !hostIsOn(parsed.url.hostname, SITE_DOMAINS.snapchat)) return false;
    const p = parsed.parts;
    if (p[0] === 'spotlight') return true;
    return p.length >= 2 && p[0].startsWith('@') && p[1] === 'spotlight';
  }

  const ShortsUrl = {
    getShortsId,
    isShortsUrl,
    shortsToWatchUrl,
    getInstagramReelCode,
    instagramRedirectUrl,
    isFacebookReelUrl,
    isSnapchatSpotlightUrl,
  };

  // For the extension: youtube.js reads this global.
  globalThis.ShortsUrl = ShortsUrl;

  // For Vitest (Node): only exists when loaded as a CommonJS module.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShortsUrl;
  }
})();
