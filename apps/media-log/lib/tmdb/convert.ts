// Converts TMDB's answer into our own MediaResult type.
// This is the ONLY file that knows TMDB's field names (release_date,
// poster_path...). If TMDB changes something, we fix it here and nowhere else.

import type { MediaResult } from "../media/types";
import type { TmdbMovie } from "./types";

// TMDB gives only the end of a poster address ("/abc.jpg"). The start, plus a
// size: w342 = 342 pixels wide, sharp enough for our grid without being huge.
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/";
export const POSTER_SIZE = "w342";

export function posterUrl(posterPath: string | null | undefined, size: string = POSTER_SIZE): string | null {
  if (!posterPath) return null;
  return `${TMDB_IMAGE_BASE}${size}${posterPath.startsWith("/") ? "" : "/"}${posterPath}`;
}

/** "2014-11-05" -> 2014. "" or junk -> null (TMDB uses "" for unknown dates). */
export function yearFromDate(date: string | null | undefined): number | null {
  const match = /^(\d{4})/.exec(date ?? "");
  return match ? Number(match[1]) : null;
}

/** One TMDB movie -> one MediaResult. */
export function tmdbMovieToMediaResult(movie: TmdbMovie): MediaResult {
  const title = movie.title?.trim() || movie.original_title?.trim() || "Untitled";
  const original = movie.original_title?.trim() || null;
  return {
    type: "movie",
    source: "tmdb",
    sourceId: String(movie.id), // our ids are text, so every source fits
    title,
    // Only keep the original title when it's different (e.g. a Japanese title).
    originalTitle: original && original !== title ? original : null,
    year: yearFromDate(movie.release_date),
    coverUrl: posterUrl(movie.poster_path),
    creators: [], // the search answer has no director; a later stage can fetch credits
    totalUnits: null, // movies have no episodes/chapters to count
    overview: movie.overview?.trim() || null,
  };
}

// A "type guard": a function that checks a value at runtime, and tells
// TypeScript "if this returns true, treat the value as a TmdbMovie".
function looksLikeMovie(value: unknown): value is TmdbMovie {
  if (typeof value !== "object" || value === null) return false;
  const movie = value as Record<string, unknown>;
  return typeof movie.id === "number" && (typeof movie.title === "string" || typeof movie.original_title === "string");
}

/**
 * A whole search answer -> a list of MediaResults.
 * Takes `unknown` on purpose: data from the internet can be anything, so we
 * check it instead of trusting it. Broken entries and adult films are skipped.
 */
export function convertTmdbSearchResponse(json: unknown): MediaResult[] {
  if (typeof json !== "object" || json === null) return [];
  const results = (json as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  return results.filter(looksLikeMovie).filter((movie) => !movie.adult).map(tmdbMovieToMediaResult);
}
