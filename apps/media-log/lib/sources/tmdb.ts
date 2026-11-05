// TMDB adapter: movies AND series (TMDB calls series "tv").
// It was lib/tmdb/ in Stage 2 (movies only). In Stage 3 the code moved here,
// the parts every adapter needs moved to ./shared.ts, and series were added.
//
// Two versions behind the same SourceAdapter contract:
// - createTmdbSource: the real API (when a TMDB key is set on the server)
// - createTmdbSampleSource: a saved sample of TMDB's answers (no key needed)
// Both go through the SAME converters, so the sample tests the real code path.
//
// Nothing in here reads process.env: the key is passed in, which keeps it
// testable. ./setup.ts decides which version to use.

import type { MediaResult, MediaType } from "../media/types";
import sampleMovies from "./samples/tmdb-search-movie.json";
import sampleTv from "./samples/tmdb-search-tv.json";
import { cleanGenres, cleanQuery, cleanText, cleanTitle, fetchJson, matchesQuery, yearFromDate } from "./shared";
import type { SourceAdapter, SourceSearchOptions } from "./types";

// ---------------------------------------------------------------------------
// TMDB's own shapes (from developer.themoviedb.org). Only this file uses them.
// ---------------------------------------------------------------------------

/** One movie in GET /3/search/movie. */
export type TmdbMovie = {
  id: number;
  title: string;
  original_title: string;
  original_language: string;
  overview: string;
  release_date: string; // "2014-11-05", or "" when unknown
  poster_path: string | null; // "/abc123.jpg", glued to TMDB's image address
  backdrop_path: string | null;
  genre_ids: number[];
  popularity: number;
  vote_average: number;
  vote_count: number;
  adult: boolean;
  video: boolean;
};

/** One series in GET /3/search/tv. Same idea, different names: name, first_air_date... */
export type TmdbTvShow = {
  id: number;
  name: string;
  original_name: string;
  original_language: string;
  origin_country: string[];
  overview: string;
  first_air_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genre_ids: number[];
  popularity: number;
  vote_average: number;
  vote_count: number;
  adult: boolean;
};

/** Both search answers have the same wrapper. `<T>` = "a list of T", movies or shows. */
export type TmdbSearchResponse<T> = {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
};

// ---------------------------------------------------------------------------
// Converting TMDB's answers into MediaResult
// ---------------------------------------------------------------------------

// TMDB gives only the end of a poster address ("/abc.jpg"). The start, plus a
// size: w342 = 342 pixels wide, sharp enough for our grid without being huge.
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/";
export const POSTER_SIZE = "w342";

export function posterUrl(posterPath: string | null | undefined, size: string = POSTER_SIZE): string | null {
  if (!posterPath) return null;
  return `${TMDB_IMAGE_BASE}${size}${posterPath.startsWith("/") ? "" : "/"}${posterPath}`;
}

// Stage 6: the search answer only gives genre NUMBERS (genre_ids: [12, 18, 878]).
// Their names come from TMDB's /genre/movie/list and /genre/tv/list, which never
// change, so we copy them here instead of asking TMDB every time. Movies and
// series share the numbers they have in common (16 is "Animation" in both).
export const TMDB_GENRES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  // Series only
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

/** [12, 18, 878] -> ["Adventure", "Drama", "Science Fiction"]. Unknown numbers are skipped. */
export function tmdbGenreNames(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return cleanGenres(ids.map((id) => (typeof id === "number" ? TMDB_GENRES[id] : undefined)));
}

// Movies and series only differ in field names, so they share this helper.
function toResult(
  type: Extract<MediaType, "movie" | "series">,
  item: { id: number; overview: string; poster_path: string | null; genre_ids?: number[] },
  rawTitle: string,
  rawOriginal: string,
  date: string,
): MediaResult {
  const title = cleanTitle(rawTitle) ?? cleanTitle(rawOriginal) ?? "Untitled";
  const original = cleanTitle(rawOriginal);
  return {
    type,
    source: "tmdb",
    sourceId: String(item.id), // our ids are text, so every source fits
    title,
    // Only keep the original title when it's different (e.g. a Japanese title).
    originalTitle: original && original !== title ? original : null,
    year: yearFromDate(date),
    coverUrl: posterUrl(item.poster_path),
    creators: [], // the search answer has no director/creator; a later stage can fetch credits
    totalUnits: null, // movies have none; for series the search answer doesn't say
    overview: cleanText(item.overview),
    genres: tmdbGenreNames(item.genre_ids),
  };
}

/** One TMDB movie -> one MediaResult. */
export function tmdbMovieToMediaResult(movie: TmdbMovie): MediaResult {
  return toResult("movie", movie, movie.title, movie.original_title, movie.release_date);
}

/** One TMDB series -> one MediaResult. */
export function tmdbTvToMediaResult(show: TmdbTvShow): MediaResult {
  return toResult("series", show, show.name, show.original_name, show.first_air_date);
}

// "Type guards": functions that check a value at runtime, and tell
// TypeScript "if this returns true, treat the value as a TmdbMovie".
function looksLikeMovie(value: unknown): value is TmdbMovie {
  if (typeof value !== "object" || value === null) return false;
  const movie = value as Record<string, unknown>;
  return typeof movie.id === "number" && (typeof movie.title === "string" || typeof movie.original_title === "string");
}

function looksLikeTvShow(value: unknown): value is TmdbTvShow {
  if (typeof value !== "object" || value === null) return false;
  const show = value as Record<string, unknown>;
  return typeof show.id === "number" && (typeof show.name === "string" || typeof show.original_name === "string");
}

/** Gets the `results` list out of an answer, or [] if the answer is something else. */
function resultsOf(json: unknown): unknown[] {
  if (typeof json !== "object" || json === null) return [];
  const results = (json as { results?: unknown }).results;
  return Array.isArray(results) ? results : [];
}

/**
 * A whole movie search answer -> MediaResults.
 * Takes `unknown` on purpose: data from the internet can be anything, so we
 * check it instead of trusting it. Broken entries and adult films are skipped.
 */
export function convertTmdbMovieResponse(json: unknown): MediaResult[] {
  return resultsOf(json).filter(looksLikeMovie).filter((movie) => !movie.adult).map(tmdbMovieToMediaResult);
}

/** A whole series search answer -> MediaResults. */
export function convertTmdbTvResponse(json: unknown): MediaResult[] {
  return resultsOf(json).filter(looksLikeTvShow).filter((show) => !show.adult).map(tmdbTvToMediaResult);
}

// ---------------------------------------------------------------------------
// The real API
// ---------------------------------------------------------------------------

export const TMDB_API_BASE = "https://api.themoviedb.org/3";
export const TMDB_KEY_HINT = "TMDB_READ_ACCESS_TOKEN / TMDB_API_KEY";

/**
 * TMDB offers two kinds of credentials (both on themoviedb.org > Settings > API):
 * - the "API Read Access Token" (long, starts with "eyJ"), sent in a header. Recommended.
 * - the "API Key" (32 letters/digits), sent in the URL as ?api_key=...
 * We accept either one.
 */
export type TmdbCredentials = { kind: "token"; value: string } | { kind: "apiKey"; value: string };

/** Picks the credential to use from the environment, or null for "use the sample". */
export function pickTmdbCredentials(env: {
  TMDB_READ_ACCESS_TOKEN?: string;
  TMDB_API_KEY?: string;
}): TmdbCredentials | null {
  const token = env.TMDB_READ_ACCESS_TOKEN?.trim();
  if (token) return { kind: "token", value: token };
  const apiKey = env.TMDB_API_KEY?.trim();
  if (apiKey) return { kind: "apiKey", value: apiKey };
  return null;
}

/** "movie" -> /search/movie, "tv" -> /search/tv. */
export type TmdbEndpoint = "movie" | "tv";

/** Builds the address and headers for one TMDB search request (no network here). */
export function buildTmdbSearchRequest(
  endpoint: TmdbEndpoint,
  query: string,
  credentials: TmdbCredentials,
): { url: string; headers: Record<string, string> } {
  // URLSearchParams takes care of encoding spaces, accents, "&"...
  const params = new URLSearchParams({
    query,
    include_adult: "false",
    language: "en-US",
    page: "1",
  });
  const headers: Record<string, string> = { accept: "application/json" };
  if (credentials.kind === "token") {
    headers.authorization = `Bearer ${credentials.value}`;
  } else {
    params.set("api_key", credentials.value);
  }
  return { url: `${TMDB_API_BASE}/search/${endpoint}?${params.toString()}`, headers };
}

const TMDB_TYPES = ["movie", "series"] as const;

/**
 * Shared by the real and the sample version: asks for movies and/or series
 * (only the ones wanted), at the same time, and converts each answer.
 * `getAnswer` is the only part that differs (network vs saved sample).
 */
async function searchTmdb(
  rawQuery: string,
  { types, limit }: SourceSearchOptions,
  getAnswer: (endpoint: TmdbEndpoint, query: string) => Promise<unknown>,
): Promise<MediaResult[]> {
  const query = cleanQuery(rawQuery);
  if (!query) return [];
  // Promise.all starts both requests at once and waits for both to finish.
  const [movies, series] = await Promise.all([
    types.includes("movie") ? getAnswer("movie", query).then(convertTmdbMovieResponse) : [],
    types.includes("series") ? getAnswer("tv", query).then(convertTmdbTvResponse) : [],
  ]);
  return [...movies.slice(0, limit), ...series.slice(0, limit)];
}

/** The real thing. `fetchFn` is a parameter so tests can pass a fake (no live calls). */
export function createTmdbSource(credentials: TmdbCredentials, fetchFn: typeof fetch = fetch): SourceAdapter {
  return {
    source: "tmdb",
    label: "TMDB",
    types: TMDB_TYPES,
    mode: "live",
    search(query, options) {
      return searchTmdb(query, options, (endpoint, cleaned) => {
        const { url, headers } = buildTmdbSearchRequest(endpoint, cleaned, credentials);
        return fetchJson(fetchFn, url, { headers }, { label: "TMDB", keyHint: TMDB_KEY_HINT });
      });
    },
  };
}

// ---------------------------------------------------------------------------
// The saved sample (no key)
// ---------------------------------------------------------------------------

// Like TMDB: the title or original title contains the text, most popular first.
// filter() makes a new array, so sorting it never reorders the sample itself.
function byPopularity(a: { popularity: number }, b: { popularity: number }): number {
  return b.popularity - a.popularity;
}

/** Searches the saved MOVIE sample and answers in TMDB's own shape. */
export function searchTmdbMovieSample(query: string): TmdbSearchResponse<TmdbMovie> {
  const results = (sampleMovies as TmdbSearchResponse<TmdbMovie>).results
    .filter((movie) => matchesQuery(cleanQuery(query), [movie.title, movie.original_title]))
    .sort(byPopularity);
  return { page: 1, results, total_pages: 1, total_results: results.length };
}

/** Searches the saved SERIES sample and answers in TMDB's own shape. */
export function searchTmdbTvSample(query: string): TmdbSearchResponse<TmdbTvShow> {
  const results = (sampleTv as TmdbSearchResponse<TmdbTvShow>).results
    .filter((show) => matchesQuery(cleanQuery(query), [show.name, show.original_name]))
    .sort(byPopularity);
  return { page: 1, results, total_pages: 1, total_results: results.length };
}

/** The no-key version. It goes through the SAME converters as the real API. */
export function createTmdbSampleSource(): SourceAdapter {
  return {
    source: "tmdb",
    label: "TMDB",
    types: TMDB_TYPES,
    mode: "sample",
    search(query, options) {
      return searchTmdb(query, options, async (endpoint, cleaned) =>
        endpoint === "movie" ? searchTmdbMovieSample(cleaned) : searchTmdbTvSample(cleaned),
      );
    },
  };
}
