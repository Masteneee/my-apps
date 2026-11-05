// The share image for pages that aren't a question (home, categories, search, suggest).
// A fixed name like site.png wins over [slug].png, so this never clashes with a question.
import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { ogSvg } from '../../lib/og';

export const GET: APIRoute = async () => {
  const svg = ogSvg({ title: 'Short, sourced answers to everyday questions', label: 'STEM first' }) // same design as the questions;
  const png = await sharp(new TextEncoder().encode(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
