import { describe, expect, it } from 'vitest';
import { ogSvg, titleLayout, wrapText } from './og';

describe('wrapText', () => {
  it('keeps whole words and respects the line length', () => {
    const lines = wrapText('Why do onions make you cry?', 12, 4);
    expect(lines).toEqual(['Why do', 'onions make', 'you cry?']);
    lines.forEach((line) => expect(line.length).toBeLessThanOrEqual(12));
  });

  it('puts a word longer than a line on its own line instead of losing it', () => {
    expect(wrapText('a supercalifragilistic b', 5, 4)).toEqual(['a', 'supercalifragilistic', 'b']);
  });

  it('stops at the maximum number of lines and ends with ...', () => {
    const lines = wrapText('one two three four five six', 3, 2);
    expect(lines).toEqual(['one', 'two...']);
  });

  it('gives no lines for empty text', () => {
    expect(wrapText('   ', 10, 3)).toEqual([]);
  });
});

describe('titleLayout', () => {
  it('uses big letters for a short title', () => {
    expect(titleLayout('Why is the sky blue?')).toEqual({ fontSize: 72, lines: ['Why is the sky blue?'] });
  });

  it('switches to smaller letters when the title needs more than 3 big lines', () => {
    const layout = titleLayout('Why does a metal spoon look bent when you put it in a tall glass of water?');
    expect(layout.fontSize).toBe(56);
    expect(layout.lines.length).toBeLessThanOrEqual(4);
    layout.lines.forEach((line) => expect(line.length).toBeLessThanOrEqual(27));
  });

  it('shortens a very long title with ... instead of overflowing', () => {
    const layout = titleLayout('word '.repeat(60));
    expect(layout.lines).toHaveLength(4);
    expect(layout.lines[3].endsWith('...')).toBe(true);
  });
});

describe('ogSvg', () => {
  it('includes the title, the category and the right size', () => {
    const svg = ogSvg({ title: 'Why is the sky blue?', label: 'Physics' });
    expect(svg).toContain('width="1200" height="630"');
    expect(svg).toContain('Why is the sky blue?');
    expect(svg).toContain('PHYSICS');
  });

  it('escapes characters that would break the SVG', () => {
    const svg = ogSvg({ title: 'Is 1 < 2 & why?', label: 'Math' });
    expect(svg).toContain('Is 1 &lt; 2 &amp; why?');
    expect(svg).not.toContain('1 < 2');
  });
});
