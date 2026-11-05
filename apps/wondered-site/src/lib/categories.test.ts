import { describe, it, expect } from 'vitest';
import { CATEGORIES, isCategory, categoryLabel, sortNewestFirst, inCategory } from './categories';

const fake = (id: string, date: string, category: (typeof CATEGORIES)[number]) => ({
  id,
  data: { date: new Date(date), category },
});

describe('categories', () => {
  it('knows the six categories from PLAN.md', () => {
    expect(CATEGORIES).toEqual(['physics', 'chemistry', 'biology', 'math', 'tech', 'everyday']);
  });

  it('accepts real categories and rejects others', () => {
    expect(isCategory('physics')).toBe(true);
    expect(isCategory('Physics')).toBe(false); // case matters: URLs use lowercase
    expect(isCategory('astrology')).toBe(false);
  });

  it('gives a readable label', () => {
    expect(categoryLabel('chemistry')).toBe('Chemistry');
  });

  it('sorts newest first without changing the original list', () => {
    const list = [fake('a', '2026-01-01', 'math'), fake('b', '2026-03-01', 'math')];
    expect(sortNewestFirst(list).map((q) => q.id)).toEqual(['b', 'a']);
    expect(list[0].id).toBe('a');
  });

  it('filters by category', () => {
    const list = [fake('a', '2026-01-01', 'math'), fake('b', '2026-01-01', 'physics')];
    expect(inCategory(list, 'physics').map((q) => q.id)).toEqual(['b']);
  });
});
