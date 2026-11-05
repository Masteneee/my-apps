// Stage 7 (performance): which cover images Next.js may optimize.
//
// <Image> from next/image doesn't send the browser straight to TMDB's poster.
// It asks OUR server (/_next/image?url=...&w=256), which downloads the poster
// once, shrinks it to the size the page needs, converts it to a lighter format
// (WebP/AVIF) and caches the result. Anyone could abuse that ("resize this
// 50 MB picture from my site for free"), so Next.js only accepts the hosts
// listed in next.config.ts (images.remotePatterns).
//
// This list is the ONE place those hosts are written. next.config.ts imports it,
// and the Poster component asks isOptimizableCover() first: a cover from any
// other host (someone could save any https address in media_items) is shown
// as a plain image instead of failing.

/** The 4 image hosts our sources use (see the cover URLs in lib/sources/*.ts). */
export const COVER_HOSTS = [
  "image.tmdb.org", // TMDB posters (movies, series)
  "s4.anilist.co", // AniList covers (anime, manga)
  "covers.openlibrary.org", // Open Library covers (books)
  "images.igdb.com", // IGDB covers (games)
] as const;

/** True when `url` is an https address on one of COVER_HOSTS (no custom port). */
export function isOptimizableCover(url: string | null | undefined): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false; // not an address at all
  }
  return (
    parsed.protocol === "https:" &&
    parsed.port === "" &&
    (COVER_HOSTS as readonly string[]).includes(parsed.hostname)
  );
}
