// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { resolveSiteUrl } from './src/lib/seo.ts';

// This config file runs before Astro loads .env.local, so we read it ourselves with loadEnv.
// loadEnv also picks up real environment variables (that's how Vercel's SITE_URL gets in),
// and those win over the file. '.' = the app folder, where npm scripts run.
// The '' prefix means "give me every variable", not only the ones starting with PUBLIC_.
const env = loadEnv('production', '.', '');
const siteUrl = resolveSiteUrl(env.SITE_URL);

// Astro builds every page to plain HTML at build time (a "static site").
// mdx() lets content files mix Markdown with components.
// Tailwind v4 plugs in as a Vite plugin (Vite is the tool Astro uses under the hood).
export default defineConfig({
  // `site` is the public address. Pages read it as Astro.site to build canonical URLs,
  // the sitemap and the full link to each share image.
  site: siteUrl,
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
});
