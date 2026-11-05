import { describe, expect, it } from 'vitest';
import { isValidYouTubeId, youTubeEmbedUrl, youTubeWatchUrl } from './youtube';

describe('isValidYouTubeId', () => {
  it('accepts a real-looking 11 character ID', () => {
    expect(isValidYouTubeId('dQw4w9WgXcQ')).toBe(true);
    expect(isValidYouTubeId('a-b_c123XYZ')).toBe(true);
  });

  it('rejects empty, missing, wrong length and pasted URLs', () => {
    expect(isValidYouTubeId('')).toBe(false);
    expect(isValidYouTubeId(undefined)).toBe(false);
    expect(isValidYouTubeId(null)).toBe(false);
    expect(isValidYouTubeId('dQw4w9WgXc')).toBe(false); // 10 characters
    expect(isValidYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe(false);
  });
});

describe('YouTube URLs', () => {
  it('embeds from the privacy-enhanced nocookie domain', () => {
    expect(youTubeEmbedUrl('dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1');
  });

  it('builds a normal watch link', () => {
    expect(youTubeWatchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });
});
