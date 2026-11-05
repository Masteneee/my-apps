import { describe, it, expect } from 'vitest';
import BlockerSettings from '../src/settings.js';

const { SITES, DEFAULT_SETTINGS, withDefaults, isSiteEnabled, setSiteEnabled } = BlockerSettings;

describe('DEFAULT_SETTINGS', () => {
  it('has every site switched on', () => {
    for (const site of SITES) expect(DEFAULT_SETTINGS[site.id]).toBe(true);
    expect(Object.keys(DEFAULT_SETTINGS)).toEqual([
      'youtube',
      'instagram',
      'tiktok',
      'facebook',
      'snapchat',
    ]);
  });
});

describe('withDefaults', () => {
  it('gives the defaults when nothing is saved yet (first run)', () => {
    expect(withDefaults(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(withDefaults(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps saved choices and fills in sites that were added later', () => {
    expect(withDefaults({ youtube: false })).toEqual({ ...DEFAULT_SETTINGS, youtube: false });
  });

  it('ignores unknown sites and values that are not true/false', () => {
    const result = withDefaults({ tiktok: 'no', myspace: false });
    expect(result.tiktok).toBe(true);
    expect('myspace' in result).toBe(false);
  });
});

describe('isSiteEnabled', () => {
  it('reads a saved choice, or the default', () => {
    expect(isSiteEnabled({ instagram: false }, 'instagram')).toBe(false);
    expect(isSiteEnabled({}, 'instagram')).toBe(true);
  });

  it('is false for a site the extension does not know', () => {
    expect(isSiteEnabled({}, 'myspace')).toBe(false);
  });
});

describe('setSiteEnabled', () => {
  it('changes one site and leaves the others as they were', () => {
    const before = withDefaults({ snapchat: false });
    const after = setSiteEnabled(before, 'facebook', false);
    expect(after).toEqual({ ...DEFAULT_SETTINGS, snapchat: false, facebook: false });
  });

  it('returns a new object instead of changing the old one', () => {
    const before = withDefaults({});
    setSiteEnabled(before, 'youtube', false);
    expect(before.youtube).toBe(true);
  });
});
