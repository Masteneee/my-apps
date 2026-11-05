// The "contract" every source adapter follows, plus the shape of a unified
// search answer. See LEARNING.md (Stage 3) for the adapter pattern.
//
// An ADAPTER is a small piece of code that talks to ONE outside API (TMDB,
// AniList, Open Library, IGDB) and converts its answers into OUR shape,
// MediaResult. The rest of the app only ever sees MediaResult, so it never
// needs to know that TMDB says "release_date" and IGDB says "first_release_date".

import { MEDIA_TYPES, type MediaResult, type MediaSource, type MediaType } from "../media/types";

/** The filter chips on the search page: "all", or one media type. */
export const SEARCH_FILTERS = ["all", ...MEDIA_TYPES] as const;
export type SearchFilter = (typeof SEARCH_FILTERS)[number];

/** Reads the filter from the URL (?type=anime). Anything unknown means "all". */
export function parseSearchFilter(value: string | null | undefined): SearchFilter {
  return (SEARCH_FILTERS as readonly string[]).includes(value ?? "") ? (value as SearchFilter) : "all";
}

/** "all" -> every media type, "anime" -> just ["anime"]. */
export function typesForFilter(filter: SearchFilter): MediaType[] {
  return filter === "all" ? [...MEDIA_TYPES] : [filter];
}

export type SourceSearchOptions = {
  /** The media types to look for. Always a subset of the adapter's own `types`. */
  types: readonly MediaType[];
  /** The most results to return PER media type. */
  limit: number;
};

/** "live" = calls the real API. "sample" = answers from saved sample responses. */
export type SourceMode = "live" | "sample";

export interface SourceAdapter {
  readonly source: MediaSource;
  /** The name users see, e.g. "Open Library". */
  readonly label: string;
  /** The media types this source can find (TMDB: movie + series). */
  readonly types: readonly MediaType[];
  readonly mode: SourceMode;
  /** Throws an Error with a user-friendly message when the API fails. */
  search(query: string, options: SourceSearchOptions): Promise<MediaResult[]>;
}

/**
 * Why a source is answering from saved samples:
 * - "no-key": the source needs a key and none is set (TMDB, IGDB)
 * - "forced": MEDIA_LOG_USE_SAMPLES=1 is set
 * - "live-failed": we tried the real API and it failed (AniList, Open Library)
 */
export type SampleReason = "no-key" | "forced" | "live-failed";

/** How one source did in one search. The page uses it for the notes above the results. */
export type SourceStatus = {
  source: MediaSource;
  label: string;
  types: MediaType[];
  state: SourceMode | "error";
  sampleReason?: SampleReason;
  /** What went wrong (state "error"), or why the live call failed ("live-failed"). */
  error?: string;
};

/** What GET /api/search answers. The search page reads the same type. */
export type UnifiedSearchResponse = {
  query: string;
  filter: SearchFilter;
  results: MediaResult[];
  sources: SourceStatus[];
};
