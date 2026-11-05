// Pure helpers for SEO: the site address, page descriptions and the sitemap.
// No Astro imports, so Vitest can test them directly.

// Placeholder address used when SITE_URL isn't set. Change SITE_URL (in .env.local and on Vercel)
// once you know the real address, so canonical links and the sitemap point to the right place.
export const DEFAULT_SITE_URL = 'https://wondered-site.vercel.app';

export const SITE_NAME = 'Have You Ever Wondered';

// Turns whatever is in SITE_URL into a clean address, or falls back to the placeholder.
// We drop the trailing slash so "https://x.com" + "/questions/a/" never gives a double slash.
export function resolveSiteUrl(value: string | undefined): string {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') return DEFAULT_SITE_URL;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return DEFAULT_SITE_URL;
    return url.origin + url.pathname.replace(/\/+$/, '');
  } catch {
    // Not a real URL (e.g. "my site"): better a working placeholder than a broken build.
    return DEFAULT_SITE_URL;
  }
}

// Joins the site address and a page path into one absolute URL (search engines want full URLs).
export function absoluteUrl(siteUrl: string, path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return siteUrl.replace(/\/+$/, '') + cleanPath;
}

// Search engines show about 155 to 160 characters of a description, so we cut longer text
// at a word boundary and add "..." instead of chopping a word in half.
export function metaDescription(text: string, maxLength = 160): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= maxLength) return oneLine;
  const cut = oneLine.slice(0, maxLength - 3);
  const lastSpace = cut.lastIndexOf(' ');
  const shortened = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return shortened.replace(/[\s,.;:]+$/, '') + '...';
}

// The text in <title>. The home page gets just the site name; other pages get "Page | Site".
export function pageTitle(title: string): string {
  return title === SITE_NAME ? SITE_NAME : `${title} | ${SITE_NAME}`;
}

export type SitemapEntry = { url: string; lastmod?: Date };

// Characters like & and < have special meaning in XML, so they must be written as codes.
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// A sitemap is a list of every page, so search engines find pages without following links.
export function buildSitemap(entries: SitemapEntry[]): string {
  const items = entries.map((entry) => {
    const lastmod = entry.lastmod ? `<lastmod>${entry.lastmod.toISOString().slice(0, 10)}</lastmod>` : '';
    return `  <url><loc>${escapeXml(entry.url)}</loc>${lastmod}</url>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...items,
    '</urlset>',
    '',
  ].join('\n');
}
