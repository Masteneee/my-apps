import { describe, expect, it } from 'vitest';
import { pickRandomSlug, relatedQuestions } from './discovery';
import type { Category } from './categories';

const q = (id: string, category: Category, date: string) => ({ id, data: { category, date: new Date(date) } });

const sky = q('sky', 'physics', '2026-01-01');
const rainbow = q('rainbow', 'physics', '2026-03-01');
const magnets = q('magnets', 'physics', '2026-02-01');
const thunder = q('thunder', 'physics', '2026-04-01');
const onions = q('onions', 'biology', '2026-05-01');
const all = [sky, rainbow, magnets, thunder, onions];

describe('relatedQuestions', () => {
  it('keeps only the same category and never the current question', () => {
    const ids = relatedQuestions(all, sky).map((x) => x.id);
    expect(ids).not.toContain('sky');
    expect(ids).not.toContain('onions');
  });

  it('sorts newest first and respects the limit', () => {
    expect(relatedQuestions(all, sky, 2).map((x) => x.id)).toEqual(['thunder', 'rainbow']);
  });

  it('returns an empty list when nothing else is in the category', () => {
    expect(relatedQuestions(all, onions)).toEqual([]);
  });
});

describe('pickRandomSlug', () => {
  const slugs = ['a', 'b', 'c'];

  it('never picks the current page when there are other choices', () => {
    // random() = 0 would pick the first choice; "a" is excluded so it must be "b".
    expect(pickRandomSlug(slugs, 'a', () => 0)).toBe('b');
    expect(pickRandomSlug(slugs, 'a', () => 0.999)).toBe('c');
  });

  it('can pick any slug when not on a question page', () => {
    expect(pickRandomSlug(slugs, null, () => 0)).toBe('a');
    expect(pickRandomSlug(slugs, null, () => 0.999)).toBe('c');
  });

  it('handles one or zero questions', () => {
    expect(pickRandomSlug(['a'], 'a', () => 0.5)).toBe('a');
    expect(pickRandomSlug([], null, () => 0.5)).toBeNull();
  });
});
