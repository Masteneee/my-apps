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
