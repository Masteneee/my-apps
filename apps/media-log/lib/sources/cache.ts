// Stage 7 (performance): caching search answers, at two levels.
//
// 1) Calls to the sources (TMDB, AniList, Open Library, IGDB).
//    Next.js adds a `next: { revalidate: seconds }` option to fetch(). With it,
//    the server keeps each source's answer in its "Data Cache" for that long:
//    the 2nd person who searches "dune" in the next hour gets TMDB's answer
//    without waiting for TMDB (and without using up TMDB's rate limit).
//    Only "200 OK" answers are kept, so an error is never remembered.
//
// 2) Our own answer, /api/search?q=dune&type=all.
//    The Cache-Control header tells the browser and Vercel's CDN (the servers
//    around the world in front of our app) how long they may reuse it.
//
// Both are pure helpers so they can be tested (cache.test.ts); ./server.ts and
// app/api/search/route.ts plug them in.

import type { UnifiedSearchResponse } from "./types";

/** How long a source's answer is reused: 1 hour. Catalogs change slowly; new releases show up within the hour. */
export const SOURCE_REVALIDATE_SECONDS = 60 * 60;

/**
 * Wraps fetch so every call also asks Next.js to cache the answer for
 * `seconds`. Everything else (method, headers, body, timeout signal) is kept.
 * The request is cached by its URL, method, headers AND body, so two different
 * searches never share an answer.
 */
export function withRevalidate(fetchFn: typeof fetch, seconds: number = SOURCE_REVALIDATE_SECONDS): typeof fetch {
  return (input, init) => fetchFn(input, { ...init, next: { ...init?.next, revalidate: seconds } });
}

// What the numbers in the header mean:
// - max-age=60: the BROWSER may reuse the answer for 1 minute (going back to the
//   results, or retyping the same search, is instant).
// - s-maxage=3600: a shared cache (Vercel's CDN) may reuse it for 1 hour, for everyone.
// - stale-while-revalidate=86400: for a day after that, the CDN may still answer
//   with the old copy right away while it fetches a fresh one in the background.
// It's "public" because the answer is the same for everyone: the route never
// reads cookies or who is logged in.
export const CACHEABLE_SEARCH = `public, max-age=60, s-maxage=${SOURCE_REVALIDATE_SECONDS}, stale-while-revalidate=86400`;

// "Don't keep this anywhere."
export const UNCACHEABLE_SEARCH = "no-store";

/**
 * The Cache-Control header for one search answer.
 * An answer where a source failed, or fell back to its sample because the live
 * call failed, is incomplete: caching it would show the "couldn't reach AniList"
 * note to everyone for an hour after AniList is back. So only complete answers are cached.
 */
export function searchCacheControl(answer: Pick<UnifiedSearchResponse, "sources">): string {
  const incomplete = answer.sources.some((s) => s.state === "error" || s.sampleReason === "live-failed");
  return incomplete ? UNCACHEABLE_SEARCH : CACHEABLE_SEARCH;
}
