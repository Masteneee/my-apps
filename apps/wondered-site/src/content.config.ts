import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CATEGORIES } from './lib/categories';
import { isValidYouTubeId } from './lib/youtube';

// One collection = one folder of similar content.
// The schema is a checklist every question file must pass; if a field is
// missing or wrong (e.g. no title), `npm run build` stops with a clear error.
const questions = defineCollection({
  // Every .mdx file in this folder becomes an entry. Its file name becomes its id
  // (why-is-the-sky-blue.mdx -> "why-is-the-sky-blue"), which we use as the URL.
  loader: glob({ pattern: '**/*.mdx', base: './src/content/questions' }),
  schema: z.object({
    title: z.string().min(1),
    category: z.enum(CATEGORIES),
    short_answer: z.string().min(1),
    // Empty "" means no video yet. Otherwise it must look like a real 11 character ID,
    // so pasting a whole URL by mistake stops the build with a clear message.
    youtube_id: z
      .string()
      .refine((id) => id === '' || isValidYouTubeId(id), 'youtube_id must be empty or an 11 character YouTube ID (the part after v= in the URL)')
      .optional(),
    sources: z.array(z.url()).min(1), // every answer must cite at least one real link
    date: z.coerce.date(), // turns "2026-11-05" into a real Date object
  }),
});

export const collections = { questions };
