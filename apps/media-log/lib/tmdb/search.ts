// Movie search, with two implementations behind ONE interface:
// - the real TMDB API (when a TMDB key is set on the server), and
// - a saved sample of TMDB's answer (no key needed, about a dozen movies).
// Both return the same MediaResult[], so the page doesn't care which one ran.
//
// Nothing in here reads process.env: the key is passed in. That keeps these
// functions testable, and ./server.ts is the one place that reads the env.

import type { MediaResult } from "../media/types";
import { convertTmdbSearchResponse } from "./convert";
import sampleResponse from "./sample-search-response.json";
import type { TmdbSearchResponse } from "./types";

export const TMDB_API_BASE = "https://api.themoviedb.org/3";
export const QUERY_MAX = 100;

/** What GET /api/movies/search answers. The search page reads the same type. */
export type MovieSearchResponse = {
  results: MediaResult[];
  usesSample: boolean; // true = no TMDB key, results come from the saved sample
  error?: string;
};

export interface MovieSearch {
  /** True when results come from the saved sample, so the UI can say so. */
  readonly usesSample: boolean;
  search(query: string): Promise<MediaResult[]>;
}

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

/** Trims the search text and cuts it to a sane length. */
export function cleanQuery(query: string): string {
  return query.trim().slice(0, QUERY_MAX);
}

/** Builds the address and headers for one TMDB search request (no network here). */
export function buildTmdbSearchRequest(
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
  return { url: `${TMDB_API_BASE}/search/movie?${params.toString()}`, headers };
}

/** The real thing. `fetchFn` is a parameter so tests can pass a fake (no live calls). */
export function createTmdbMovieSearch(credentials: TmdbCredentials, fetchFn: typeof fetch = fetch): MovieSearch {
  return {
    usesSample: false,
    async search(rawQuery) {
      const query = cleanQuery(rawQuery);
      if (!query) return [];

      const { url, headers } = buildTmdbSearchRequest(query, credentials);
      let response: Response;
      try {
        response = await fetchFn(url, { headers });
      } catch {
        // fetch only throws when there's no answer at all (offline, DNS...).
        throw new Error("Couldn't reach TMDB. Check your internet connection and try again.");
      }

      if (response.status === 401) {
        throw new Error("TMDB refused the key. Check TMDB_READ_ACCESS_TOKEN / TMDB_API_KEY in .env.local.");
      }
      if (response.status === 429) {
        throw new Error("Too many searches at once. Wait a few seconds and try again.");
      }
      if (!response.ok) {
        throw new Error(`TMDB had a problem (error ${response.status}). Try again later.`);
      }
      return convertTmdbSearchResponse(await response.json());
    },
  };
}

// Lowercase, no accents, no punctuation: "Amélie!" and "amelie" now match.
// NFD splits "é" into "e" + an accent mark, and the regex removes the marks.
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Searches the saved sample like TMDB would (title or original title contains
 * the text, most popular first) and answers in TMDB's own shape.
 */
export function searchSampleResponse(query: string): TmdbSearchResponse {
  const wanted = normalize(cleanQuery(query));
  const all = (sampleResponse as TmdbSearchResponse).results;
  const results = wanted
    ? all
        .filter((movie) => normalize(movie.title).includes(wanted) || normalize(movie.original_title).includes(wanted))
        // filter() made a new array, so sorting it never reorders the sample itself.
        .sort((a, b) => b.popularity - a.popularity)
    : [];
  return { page: 1, results, total_pages: 1, total_results: results.length };
}

/** The no-key version. It goes through the SAME converter as the real API. */
export function createSampleMovieSearch(): MovieSearch {
  return {
    usesSample: true,
    async search(query) {
      return convertTmdbSearchResponse(searchSampleResponse(query));
    },
  };
}
