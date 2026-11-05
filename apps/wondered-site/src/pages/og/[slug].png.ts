// Makes one share image per question at build time: /og/why-is-the-sky-blue.png
// The file name "[slug].png.ts" means: a dynamic route whose output files end in .png.
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import sharp from 'sharp';
import { categoryLabel } from '../../lib/categories';
import { ogSvg } from '../../lib/og';

export const getStaticPaths = (async () => {
  const questions = await getCollection('questions');
  return questions.map((question) => ({
    params: { slug: question.id },
    props: { title: question.data.title, label: categoryLabel(question.data.category) },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const svg = ogSvg({ title: props.title, label: props.label });
  // sharp turns the SVG drawing into a real PNG picture (social sites don't show SVG previews).
  const png = await sharp(new TextEncoder().encode(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
