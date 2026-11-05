import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_URL, absoluteUrl, buildSitemap, escapeXml, metaDescription, pageTitle, resolveSiteUrl } from './seo';

describe('resolveSiteUrl', () => {
  it('falls back to the placeholder when SITE_URL is missing or empty', () => {
    expect(resolveSiteUrl(undefined)).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl('  ')).toBe(DEFAULT_SITE_URL);
  });

  it('removes the trailing slash so paths never get a double slash', () => {
    expect(resolveSiteUrl('https://wondered.ca/')).toBe('https://wondered.ca');
  });

  it('keeps a sub-folder (for hosts like GitHub Pages)', () => {
    expect(resolveSiteUrl('https://me.github.io/wondered/')).toBe('https://me.github.io/wondered');
  });

  it('falls back when the value is not a web address', () => {
    expect(resolveSiteUrl('my site')).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl('ftp://wondered.ca')).toBe(DEFAULT_SITE_URL);
  });
});

describe('absoluteUrl', () => {
  it('joins the site and the path with exactly one slash', () => {
    expect(absoluteUrl('https://wondered.ca', '/questions/a/')).toBe('https://wondered.ca/questions/a/');
    expect(absoluteUrl('https://wondered.ca/', 'search/')).toBe('https://wondered.ca/search/');
  });
});

describe('metaDescription', () => {
  it('keeps short text as it is (on one line)', () => {
    expect(metaDescription('Ice floats\n because it is less dense.')).toBe('Ice floats because it is less dense.');
  });

  it('cuts long text at a word and adds ...', () => {
    const result = metaDescription('one two three four five', 15);
    expect(result).toBe('one two...');
    expect(result.length).toBeLessThanOrEqual(15);
  });

  it('never goes over 160 characters by default', () => {
    expect(metaDescription('word '.repeat(100)).length).toBeLessThanOrEqual(160);
  });
});

describe('pageTitle', () => {
  it('adds the site name after the page name', () => {
    expect(pageTitle('Why is the sky blue?')).toBe('Why is the sky blue? | Have You Ever Wondered');
  });

  it('does not repeat the site name on the home page', () => {
    expect(pageTitle('Have You Ever Wondered')).toBe('Have You Ever Wondered');
  });
});

describe('buildSitemap', () => {
  it('lists every URL, with a date only when one is given', () => {
    const xml = buildSitemap([
      { url: 'https://wondered.ca/' },
      { url: 'https://wondered.ca/questions/a/', lastmod: new Date('2026-11-05') },
    ]);
    expect(xml).toContain('<loc>https://wondered.ca/</loc></url>');
    expect(xml).toContain('<loc>https://wondered.ca/questions/a/</loc><lastmod>2026-11-05</lastmod>');
    expect(xml.startsWith('<?xml')).toBe(true);
  });

  it('escapes special characters so the XML stays valid', () => {
    expect(escapeXml('a & b < c')).toBe('a &amp; b &lt; c');
    expect(buildSitemap([{ url: 'https://x.ca/?a=1&b=2' }])).toContain('?a=1&amp;b=2');
  });
});
