// Pure helpers for the YouTube embed. No browser code, so Vitest can test them.

// Every YouTube video ID is exactly 11 characters: letters, digits, "-" or "_".
// Checking it stops a typo (or a whole pasted URL) from building a broken embed.
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function isValidYouTubeId(id: string | undefined | null): id is string {
  return typeof id === 'string' && YOUTUBE_ID.test(id);
}

// youtube-nocookie.com is YouTube's "privacy-enhanced mode": it doesn't set tracking
// cookies until the visitor actually plays the video.
// autoplay=1 is fine here because the iframe only appears after the visitor clicked "Play".
export function youTubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;
}

// A normal link for people who'd rather watch on YouTube itself.
export function youTubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}
