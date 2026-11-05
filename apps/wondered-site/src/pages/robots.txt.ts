// /robots.txt tells search engine robots they may visit everything, and where the sitemap is.
import type { APIRoute } from 'astro';
import { DEFAULT_SITE_URL, absoluteUrl } from '../lib/seo';

export const GET: APIRoute = ({ site }) => {
  const sitemap = absoluteUrl(site?.href ?? DEFAULT_SITE_URL, '/sitemap.xml');
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain' },
  });
};
