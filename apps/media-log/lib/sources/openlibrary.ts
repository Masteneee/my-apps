// Open Library adapter: books. Open Library (run by the Internet Archive)
// needs no key. Its search answers with "works": a work is the book itself,
// no matter how many editions or translations it has.
//
// Two versions behind the SourceAdapter contract, like every adapter:
// createOpenLibrarySource (real API) and createOpenLibrarySampleSource (saved sample).

import { genreToTags } from "../media/tags";
import type { MediaResult } from "../media/types";
import sample from "./samples/openlibrary-search.json";
import {
  cleanGenres,
  cleanQuery,
  cleanText,
  cleanTitle,
  cleanTotalUnits,
  cleanYear,
  fetchJson,
  matchesQuery,
  uniqueNames,
} from "./shared";
import type { SourceAdapter, SourceSearchOptions } from "./types";

// ---------------------------------------------------------------------------
// Open Library's own shapes (from openlibrary.org/dev/docs/api/search).
// Every field except `key` and `title` can be missing.
// ---------------------------------------------------------------------------

export type OpenLibraryDoc = {
  key: string; // "/works/OL893415W"
  title: string;
  subtitle?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number; // a cover image number, see coverUrl()
  number_of_pages_median?: number;
  edition_count?: number;
  // Stage 6: free-text subjects typed by librarians, often dozens:
  // "Science fiction", "Mars (Planet)", "Fiction, science fiction, general"...
  subject?: string[];
};

export type OpenLibrarySearchResponse = {
  numFound: number;
  start: number;
  numFoundExact: boolean;
  docs: OpenLibraryDoc[];
  num_found: number;
  q: string;
  offset: number | null;
};

// ---------------------------------------------------------------------------
// Converting Open Library's answers into MediaResult
// ---------------------------------------------------------------------------

// Covers come from a separate site. "-M" = medium size (about 180 px wide).
export const OPEN_LIBRARY_COVER_BASE = "https://covers.openlibrary.org/b/id/";

export function openLibraryCoverUrl(coverId: number | undefined): string | null {
  return typeof coverId === "number" && coverId > 0 ? `${OPEN_LIBRARY_COVER_BASE}${coverId}-M.jpg` : null;
}

/** "/works/OL893415W" -> "OL893415W" (shorter, and it's what Open Library calls the id). */
export function workIdFromKey(key: string): string {
  return key.replace(/^\/works\//, "");
}

/**
 * Stage 6: only the subjects our shared tag map understands (lib/media/tags.ts).
 * A popular book can have 100+ subjects ("Arrakis (Imaginary place)", "Large type
 * books"...), so keeping all of them would fill the database with words nobody uses.
 */
export function openLibraryGenres(subjects: unknown): string[] {
  if (!Array.isArray(subjects)) return [];
  return cleanGenres(subjects.filter((s): s is string => typeof s === "string" && genreToTags(s).length > 0));
}

export function openLibraryDocToMediaResult(doc: OpenLibraryDoc): MediaResult {
  return {
    type: "book",
    source: "openlibrary",
    sourceId: workIdFromKey(doc.key),
    title: cleanTitle(doc.title) ?? "Untitled",
    originalTitle: null, // the search answer doesn't say which title is the original
    year: cleanYear(doc.first_publish_year),
    coverUrl: openLibraryCoverUrl(doc.cover_i),
    creators: uniqueNames(doc.author_name ?? [], 3),
    // Books are counted in pages. Editions differ, so Open Library gives the median.
    totalUnits: cleanTotalUnits(doc.number_of_pages_median),
    // The search has no summary; the subtitle is the closest thing.
    overview: cleanText(doc.subtitle),
    genres: openLibraryGenres(doc.subject),
  };
}

function looksLikeWork(value: unknown): value is OpenLibraryDoc {
  if (typeof value !== "object" || value === null) return false;
  const doc = value as Record<string, unknown>;
  // Only works: the search can also match other things, whose key isn't "/works/...".
  return typeof doc.key === "string" && doc.key.startsWith("/works/") && typeof doc.title === "string";
}

export function convertOpenLibraryResponse(json: unknown): MediaResult[] {
  if (typeof json !== "object" || json === null) return [];
  const docs = (json as { docs?: unknown }).docs;
  if (!Array.isArray(docs)) return [];
  return docs.filter(looksLikeWork).map(openLibraryDocToMediaResult);
}

// ---------------------------------------------------------------------------
// The real API
// ---------------------------------------------------------------------------

export const OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json";

// Asking for only the fields we use makes the answer much smaller and faster.
export const OPEN_LIBRARY_FIELDS =
  "key,title,subtitle,author_name,first_publish_year,cover_i,number_of_pages_median,edition_count,subject";

export function buildOpenLibraryRequest(query: string, limit: number): { url: string; headers: Record<string, string> } {
  const params = new URLSearchParams({ q: query, fields: OPEN_LIBRARY_FIELDS, limit: String(limit) });
  return {
    url: `${OPEN_LIBRARY_SEARCH_URL}?${params.toString()}`,
    // Open Library asks apps to say who they are, so they can contact us
    // instead of blocking us if something goes wrong.
    headers: { accept: "application/json", "user-agent": "MediaLog/0.1 (personal learning project)" },
  };
}

export function createOpenLibrarySource(fetchFn: typeof fetch = fetch): SourceAdapter {
  return {
    source: "openlibrary",
    label: "Open Library",
    types: ["book"],
    mode: "live",
    async search(rawQuery, { types, limit }: SourceSearchOptions) {
      const query = cleanQuery(rawQuery);
      if (!query || !types.includes("book")) return [];
      const { url, headers } = buildOpenLibraryRequest(query, limit);
      return convertOpenLibraryResponse(await fetchJson(fetchFn, url, { headers }, { label: "Open Library" }));
    },
  };
}

// ---------------------------------------------------------------------------
// The saved sample
// ---------------------------------------------------------------------------

/** Searches the saved sample (title, subtitle or author) and answers in Open Library's own shape. */
export function searchOpenLibrarySample(query: string, limit: number): OpenLibrarySearchResponse {
  const wanted = cleanQuery(query);
  const all = (sample as OpenLibrarySearchResponse).docs;
  const docs = all
    .filter((doc) => matchesQuery(wanted, [doc.title, doc.subtitle, ...(doc.author_name ?? [])]))
    .slice(0, limit);
  return {
    numFound: docs.length,
    start: 0,
    numFoundExact: true,
    docs,
    num_found: docs.length,
    q: wanted,
    offset: null,
  };
}

export function createOpenLibrarySampleSource(): SourceAdapter {
  return {
    source: "openlibrary",
    label: "Open Library",
    types: ["book"],
    mode: "sample",
    async search(query, { types, limit }) {
      if (!cleanQuery(query) || !types.includes("book")) return [];
      return convertOpenLibraryResponse(searchOpenLibrarySample(query, limit));
    },
  };
}
