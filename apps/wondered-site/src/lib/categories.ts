// Pure helpers about categories. No Astro imports here, so Vitest can test them directly.

// "as const" makes TypeScript treat this as a fixed list of exact strings,
// which lets the content schema reject any category not in this list.
export const CATEGORIES = ['physics', 'chemistry', 'biology', 'math', 'tech', 'everyday'] as const;

export type Category = (typeof CATEGORIES)[number];

const LABELS: Record<Category, string> = {
  physics: 'Physics',
  chemistry: 'Chemistry',
  biology: 'Biology',
  math: 'Math',
  tech: 'Tech',
  everyday: 'Everyday',
};

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export function categoryLabel(category: Category): string {
  return LABELS[category];
}

// Only the fields these helpers need, so tests can pass tiny fake objects
// instead of real Astro content entries.
type Dated = { data: { date: Date; category: Category } };

// Newest first. We copy with [...list] because .sort() changes the original array.
export function sortNewestFirst<T extends Dated>(list: T[]): T[] {
  return [...list].sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function inCategory<T extends Dated>(list: T[], category: Category): T[] {
  return list.filter((item) => item.data.category === category);
}
