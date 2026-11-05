// Pure helpers that draw a social share image as SVG text.
// SVG is just XML describing shapes, so we can build it as a string and test it without a browser.
// The build turns this SVG into a PNG (see src/pages/og/[slug].png.ts), because social sites don't accept SVG.
import { escapeXml } from './seo';

export const OG_WIDTH = 1200; // 1200 x 630 is the size Facebook, X, LinkedIn and Discord all expect
export const OG_HEIGHT = 630;

// SVG has no automatic line wrapping, so we split the title into lines ourselves.
// Words stay whole; a single word longer than a line gets its own line.
// If there are more lines than fit, the last one ends with "...".
export function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (candidate.length <= maxCharsPerLine || current === '') {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== '') lines.push(current);

  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = kept[maxLines - 1].replace(/[\s,.;:?!]+$/, '') + '...';
  return kept;
}

// Two layouts: big letters for short titles, smaller letters (so more fit per line) for long ones.
// charsPerLine is how many bold letters fit in the ~1040 px wide text area at that size
// (measured on the real images: a bold letter is about 0.66 times the font size wide).
const LAYOUTS = [
  { fontSize: 72, charsPerLine: 21, maxLines: 3 },
  { fontSize: 56, charsPerLine: 27, maxLines: 4 },
];

// Picks the first layout the title fits in without "...", or the last one if none does.
export function titleLayout(title: string): { fontSize: number; lines: string[] } {
  for (const layout of LAYOUTS) {
    const lines = wrapText(title, layout.charsPerLine, layout.maxLines + 1);
    if (lines.length <= layout.maxLines) return { fontSize: layout.fontSize, lines };
  }
  const last = LAYOUTS[LAYOUTS.length - 1];
  return { fontSize: last.fontSize, lines: wrapText(title, last.charsPerLine, last.maxLines) };
}

type OgInput = { title: string; label: string };

// Our own simple design: dark background, a big "?" in the corner, the category as a pill,
// the question in large white letters and the site name at the bottom.
export function ogSvg({ title, label }: OgInput): string {
  const { fontSize, lines } = titleLayout(title);
  const lineHeight = Math.round(fontSize * 1.18);
  // Centre the block of title lines vertically in the space between the pill and the footer.
  const blockHeight = lineHeight * lines.length;
  const firstBaseline = Math.round(330 - blockHeight / 2 + fontSize * 0.8);
  const pillWidth = 40 + label.length * 21;
  // Fonts listed in order of preference; the build machine uses the first one it has.
  const font = "'DejaVu Sans', 'Liberation Sans', Arial, Helvetica, sans-serif";

  const titleLines = lines
    .map((line, i) => `<tspan x="80" y="${firstBaseline + i * lineHeight}">${escapeXml(line)}</tspan>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#312e81"/>
    </linearGradient>
  </defs>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)"/>
  <text x="1150" y="560" text-anchor="end" font-family="${font}" font-size="520" font-weight="700" fill="#6366f1" fill-opacity="0.18">?</text>
  <rect x="80" y="70" width="${pillWidth}" height="52" rx="26" fill="#6366f1"/>
  <text x="${80 + pillWidth / 2}" y="105" text-anchor="middle" font-family="${font}" font-size="26" font-weight="700" fill="#ffffff" letter-spacing="3">${escapeXml(label.toUpperCase())}</text>
  <text font-family="${font}" font-size="${fontSize}" font-weight="700" fill="#ffffff">${titleLines}</text>
  <rect x="80" y="528" width="64" height="6" rx="3" fill="#a5b4fc"/>
  <text x="80" y="580" font-family="${font}" font-size="30" font-weight="700" fill="#c7d2fe">Have You Ever Wondered?</text>
</svg>`;
}
