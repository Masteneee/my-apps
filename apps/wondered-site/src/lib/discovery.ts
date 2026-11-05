// Pure helpers for "related questions" and the "random question" button.
// No Astro or browser imports, so Vitest can test them with tiny fake objects.
import type { Category } from './categories';

// Only the fields these helpers need (a real Astro entry has many more).
type Entry = { id: string; data: { category: Category; date: Date } };

// Questions in the same category as `current`, never `current` itself,
// newest first, at most `limit` of them.
export function relatedQuestions<T extends Entry>(all: T[], current: T, limit = 3): T[] {
  return all
    .filter((q) => q.data.category === current.data.category && q.id !== current.id)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
    .slice(0, limit);
}

// Picks one slug at random, skipping the page you're already on
// (a "random" button that reloads the same page feels broken).
// `random` is passed in so tests can control it; in the browser we pass Math.random.
export function pickRandomSlug(
  slugs: string[],
  currentSlug: string | null,
  random: () => number = Math.random,
): string | null {
  const choices = slugs.filter((s) => s !== currentSlug);
  if (choices.length === 0) return slugs[0] ?? null; // only one question exists: go there anyway
  // random() is in [0, 1), so the index is always 0 .. length-1.
  return choices[Math.floor(random() * choices.length)];
}
