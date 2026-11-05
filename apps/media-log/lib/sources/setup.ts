// Decides, from the environment variables, which version of each source the
// search uses. It takes `env` as a parameter (instead of reading process.env)
// so tests can try every combination. ./server.ts passes the real env.
//
//                 key set?   MEDIA_LOG_USE_SAMPLES=1   no key needed
// TMDB, IGDB      live       sample ("forced")         sample when no key ("no-key")
// AniList, OL     -          sample ("forced")         live, sample if the call fails

import { createAniListSampleSource, createAniListSource } from "./anilist";
import {
  createIgdbSampleSource,
  createIgdbSource,
  pickIgdbCredentials,
  type IgdbCredentials,
  type TokenProvider,
} from "./igdb";
import { createOpenLibrarySampleSource, createOpenLibrarySource } from "./openlibrary";
import { createTmdbSampleSource, createTmdbSource, pickTmdbCredentials } from "./tmdb";
import type { SourceEntry } from "./unified";

export type SourceEnv = {
  TMDB_READ_ACCESS_TOKEN?: string;
  TMDB_API_KEY?: string;
  IGDB_CLIENT_ID?: string;
  IGDB_CLIENT_SECRET?: string;
  MEDIA_LOG_USE_SAMPLES?: string;
};

export type SourceSetupOptions = {
  fetchFn?: typeof fetch;
  /** Where the IGDB token is remembered between searches (see server.ts). */
  igdbTokens?: (credentials: IgdbCredentials) => TokenProvider;
};

/** "1", "true" or "yes" turn the flag on. */
export function samplesForced(env: SourceEnv): boolean {
  return ["1", "true", "yes"].includes(env.MEDIA_LOG_USE_SAMPLES?.trim().toLowerCase() ?? "");
}

// Shortcut for "this source answers from its sample, for this reason".
const sampleOnly = (adapter: SourceEntry["adapter"], reason: "no-key" | "forced"): SourceEntry => ({
  adapter,
  fallback: null,
  sampleReason: reason,
});

/** The four sources, in priority order (when two results are the same thing, the earlier source usually wins). */
export function createSourceEntries(env: SourceEnv, { fetchFn = fetch, igdbTokens }: SourceSetupOptions = {}): SourceEntry[] {
  if (samplesForced(env)) {
    return [
      sampleOnly(createTmdbSampleSource(), "forced"),
      sampleOnly(createAniListSampleSource(), "forced"),
      sampleOnly(createOpenLibrarySampleSource(), "forced"),
      sampleOnly(createIgdbSampleSource(), "forced"),
    ];
  }

  const tmdb = pickTmdbCredentials(env);
  const igdb = pickIgdbCredentials(env);
  return [
    // Sources WITH a key report their errors (a wrong key should be fixed, not hidden).
    tmdb
      ? { adapter: createTmdbSource(tmdb, fetchFn), fallback: null, sampleReason: null }
      : sampleOnly(createTmdbSampleSource(), "no-key"),
    // Sources WITHOUT a key fall back to their samples when the call fails.
    { adapter: createAniListSource(fetchFn), fallback: createAniListSampleSource(), sampleReason: null },
    { adapter: createOpenLibrarySource(fetchFn), fallback: createOpenLibrarySampleSource(), sampleReason: null },
    igdb
      ? { adapter: createIgdbSource(igdb, fetchFn, igdbTokens?.(igdb)), fallback: null, sampleReason: null }
      : sampleOnly(createIgdbSampleSource(), "no-key"),
  ];
}
