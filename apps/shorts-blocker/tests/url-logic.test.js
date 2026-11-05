import { describe, it, expect } from 'vitest';
// url-logic.js uses module.exports (see the comment at its top), so we import
// the whole object and pull the functions out of it.
import ShortsUrl from '../src/url-logic.js';

const { getShortsId, isShortsUrl, shortsToWatchUrl } = ShortsUrl;

const ID = 'dQw4w9WgXcQ'; // a valid 11-character video ID

describe('getShortsId', () => {
  it('reads the ID from a full Shorts URL', () => {
    expect(getShortsId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
  });

  it('reads the ID from a relative link, like the ones in YouTube pages', () => {
    expect(getShortsId(`/shorts/${ID}`)).toBe(ID);
  });

  it('ignores query strings and a trailing slash', () => {
    expect(getShortsId(`https://youtube.com/shorts/${ID}/?feature=share`)).toBe(ID);
  });

  it('returns null for a normal video, the Shorts feed, or a bad ID', () => {
    expect(getShortsId(`https://www.youtube.com/watch?v=${ID}`)).toBeNull();
    expect(getShortsId('https://www.youtube.com/shorts/')).toBeNull();
    expect(getShortsId('https://www.youtube.com/shorts/tooShort')).toBeNull();
  });

  it('returns null for other websites', () => {
    expect(getShortsId(`https://example.com/shorts/${ID}`)).toBeNull();
  });

  it('returns null for empty or non-string input instead of crashing', () => {
    expect(getShortsId('')).toBeNull();
    expect(getShortsId(null)).toBeNull();
    expect(getShortsId(undefined)).toBeNull();
  });
});

describe('isShortsUrl', () => {
  it('is true for a Short and false for a normal video', () => {
    expect(isShortsUrl(`/shorts/${ID}`)).toBe(true);
    expect(isShortsUrl(`/watch?v=${ID}`)).toBe(false);
  });

  it('is false for a channel page that has "shorts" in its path', () => {
    expect(isShortsUrl('https://www.youtube.com/@somechannel/shorts')).toBe(false);
  });
});

describe('shortsToWatchUrl', () => {
  it('turns /shorts/ID into /watch?v=ID', () => {
    expect(shortsToWatchUrl(`https://www.youtube.com/shorts/${ID}`)).toBe(
      `https://www.youtube.com/watch?v=${ID}`
    );
  });

  it('keeps the mobile site on mobile', () => {
    expect(shortsToWatchUrl(`https://m.youtube.com/shorts/${ID}`)).toBe(
      `https://m.youtube.com/watch?v=${ID}`
    );
  });

  it('returns null when the URL is not a Short, so nothing gets redirected', () => {
    expect(shortsToWatchUrl(`https://www.youtube.com/watch?v=${ID}`)).toBeNull();
    expect(shortsToWatchUrl('https://www.youtube.com/')).toBeNull();
  });
});

// --- Stage 2: other sites ---------------------------------------------------

const {
  getInstagramReelCode,
  instagramRedirectUrl,
  isFacebookReelUrl,
  isSnapchatSpotlightUrl,
} = ShortsUrl;

const CODE = 'C1a2B3c4D5e'; // an Instagram post/reel code

describe('getInstagramReelCode', () => {
  it('reads the code from the three Reel address shapes', () => {
    expect(getInstagramReelCode(`https://www.instagram.com/reel/${CODE}/`)).toBe(CODE);
    expect(getInstagramReelCode(`https://www.instagram.com/reels/${CODE}/`)).toBe(CODE);
    expect(getInstagramReelCode(`https://www.instagram.com/someone/reel/${CODE}/`)).toBe(CODE);
  });

  it('works with relative links from the page', () => {
    expect(getInstagramReelCode(`/reel/${CODE}/?igsh=abc`)).toBe(CODE);
  });

  it('returns null for normal posts, the Reels feed, profiles and other sites', () => {
    expect(getInstagramReelCode(`https://www.instagram.com/p/${CODE}/`)).toBeNull();
    expect(getInstagramReelCode('https://www.instagram.com/reels/')).toBeNull();
    expect(getInstagramReelCode('https://www.instagram.com/someone/')).toBeNull();
    expect(getInstagramReelCode(`https://example.com/reel/${CODE}/`)).toBeNull();
    expect(getInstagramReelCode(null)).toBeNull();
  });
});

describe('instagramRedirectUrl', () => {
  it('opens a single Reel as a normal post', () => {
    expect(instagramRedirectUrl(`https://www.instagram.com/reel/${CODE}/`)).toBe(
      `https://www.instagram.com/p/${CODE}/`
    );
  });

  it('sends the Reels feed back to the home feed', () => {
    expect(instagramRedirectUrl('https://www.instagram.com/reels/')).toBe(
      'https://www.instagram.com/'
    );
  });

  it('leaves normal pages alone (no redirect loop on /p/)', () => {
    expect(instagramRedirectUrl(`https://www.instagram.com/p/${CODE}/`)).toBeNull();
    expect(instagramRedirectUrl('https://www.instagram.com/')).toBeNull();
    expect(instagramRedirectUrl('https://www.instagram.com/someone/reels/')).toBeNull();
  });
});

describe('isFacebookReelUrl', () => {
  it('is true for single Reels, the Reels tab and the Reels feed', () => {
    expect(isFacebookReelUrl('https://www.facebook.com/reel/1234567890')).toBe(true);
    expect(isFacebookReelUrl('https://www.facebook.com/reel/?s=tab')).toBe(true);
    expect(isFacebookReelUrl('https://m.facebook.com/reels/')).toBe(true);
  });

  it('is false for the feed, normal videos and lookalike sites', () => {
    expect(isFacebookReelUrl('https://www.facebook.com/')).toBe(false);
    expect(isFacebookReelUrl('https://www.facebook.com/watch/?v=123')).toBe(false);
    expect(isFacebookReelUrl('https://www.facebook.com/someone/posts/reel')).toBe(false);
    expect(isFacebookReelUrl('https://notfacebook.com/reel/123')).toBe(false);
  });
});

describe('isSnapchatSpotlightUrl', () => {
  it('is true for the Spotlight feed, a Spotlight and a user Spotlight', () => {
    expect(isSnapchatSpotlightUrl('https://www.snapchat.com/spotlight')).toBe(true);
    expect(isSnapchatSpotlightUrl('https://www.snapchat.com/spotlight/W7_EDlXWTBi')).toBe(true);
    expect(isSnapchatSpotlightUrl('https://www.snapchat.com/@someone/spotlight/abc')).toBe(true);
  });

  it('is false for other Snapchat pages and other sites', () => {
    expect(isSnapchatSpotlightUrl('https://www.snapchat.com/')).toBe(false);
    expect(isSnapchatSpotlightUrl('https://www.snapchat.com/add/someone')).toBe(false);
    expect(isSnapchatSpotlightUrl('https://example.com/spotlight')).toBe(false);
    expect(isSnapchatSpotlightUrl('')).toBe(false);
  });
});
