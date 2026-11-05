// Builds /sitemap.xml at build time: the list of every page for search engines.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { CATEGORIES } from '../lib/categories';
import { DEFAULT_SITE_URL, absoluteUrl, buildSitemap, type SitemapEntry } from '../lib/seo';

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = site?.href ?? DEFAULT_SITE_URL;
  const questions = await getCollection('questions');

  const entries: SitemapEntry[] = [
    { url: absoluteUrl(siteUrl, '/') },
    { url: absoluteUrl(siteUrl, '/search/') },
    { url: absoluteUrl(siteUrl, '/suggest/') },
    ...CATEGORIES.map((c) => ({ url: absoluteUrl(siteUrl, `/category/${c}/`) })),
    ...questions.map((q) => ({ url: absoluteUrl(siteUrl, `/questions/${q.id}/`), lastmod: q.data.date })),
  ];
  return new Response(buildSitemap(entries), { headers: { 'Content-Type': 'application/xml' } });
};
