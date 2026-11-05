// The unified search: ask every source that covers the wanted media types,
// AT THE SAME TIME, then merge the answers into one list.
//
// One source failing never breaks the whole search: its error is reported
// in `sources`, and the other sources' results are still shown.
// Sources that need no key (AniList, Open Library) can also fall back to
// their saved samples when the real API can't be reached.

import type { MediaResult, MediaType } from "../media/types";
import { mergeResults } from "./merge";
import { cleanQuery } from "./shared";
import {
  typesForFilter,
  type SampleReason,
  type SearchFilter,
  type SourceAdapter,
  type SourceSearchOptions,
  type SourceStatus,
  type UnifiedSearchResponse,
} from "./types";

/** One source, as set up by ./setup.ts. */
export type SourceEntry = {
  /** What we try first: the real API, or the sample when there is no key. */
  adapter: SourceAdapter;
  /** The saved samples to use if `adapter` fails. Null = just report the error. */
  fallback: SourceAdapter | null;
  /** Why `adapter` is a sample one ("no-key" or "forced"). Null when it's live. */
  sampleReason: Exclude<SampleReason, "live-failed"> | null;
};

/** Fewer results per type when showing all types, so the list stays readable. */
export function perTypeLimit(types: readonly MediaType[]): number {
  return types.length === 1 ? 20 : 8;
}

type SourceAnswer = { results: MediaResult[]; status: SourceStatus };

/** Searches ONE source. Never throws: problems end up in the status. */
async function searchOneSource(
  entry: SourceEntry,
  query: string,
  options: SourceSearchOptions,
  warn: (message: string) => void,
): Promise<SourceAnswer> {
  const { adapter, fallback, sampleReason } = entry;
  const base = { source: adapter.source, label: adapter.label, types: [...options.types] };
  const firstState = sampleReason ? { state: "sample" as const, sampleReason } : { state: "live" as const };

  // An empty search (the page asks once on load) just reports how each source is set up.
  if (!query) return { results: [], status: { ...base, ...firstState } };

  try {
    return { results: await adapter.search(query, options), status: { ...base, ...firstState } };
  } catch (err) {
    const message = err instanceof Error ? err.message : `${adapter.label} search failed.`;
    if (fallback) {
      // Written to the terminal running `npm run dev`, to help debugging.
      warn(`[search] ${adapter.label} failed, using saved samples instead: ${message}`);
      try {
        const results = await fallback.search(query, options);
        return { results, status: { ...base, state: "sample", sampleReason: "live-failed", error: message } };
      } catch {
        // Very unlikely (the sample is a file), but then report the original problem.
      }
    }
    return { results: [], status: { ...base, state: "error", error: message } };
  }
}

/**
 * Searches every source that covers the filter, in parallel, and merges the
 * answers. `warn` is a parameter so tests can check it (and keep the output quiet).
 */
export async function unifiedSearch(
  rawQuery: string,
  filter: SearchFilter,
  entries: SourceEntry[],
  warn: (message: string) => void = console.warn,
): Promise<UnifiedSearchResponse> {
  const query = cleanQuery(rawQuery);
  const wanted = typesForFilter(filter);
  const limit = perTypeLimit(wanted);

  // Only the sources that can find at least one wanted type (no IGDB call for "anime").
  const active = entries
    .map((entry) => ({ entry, types: entry.adapter.types.filter((type) => wanted.includes(type)) }))
    .filter(({ types }) => types.length > 0);

  // Promise.all waits for ALL sources. Each one never throws (see above), so a
  // slow or broken source can't hide the others' results.
  const answers = await Promise.all(
    active.map(({ entry, types }) => searchOneSource(entry, query, { types, limit }, warn)),
  );

  return {
    query,
    filter,
    results: mergeResults(
      answers.flatMap((answer) => answer.results),
      query,
    ),
    sources: answers.map((answer) => answer.status),
  };
}
