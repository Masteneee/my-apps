// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

// Astro builds every page to plain HTML at build time (a "static site").
// mdx() lets content files mix Markdown with components.
// Tailwind v4 plugs in as a Vite plugin (Vite is the tool Astro uses under the hood).
export default defineConfig({
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
});
