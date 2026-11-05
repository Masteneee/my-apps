// Stage 6: the saved samples as a small "catalog" for recommendations.
//
// We never copy a whole outside catalog (PLAN.md), and there's no internet
// here. So recommendations pick from two places:
// 1. items already in OUR database (someone logged them), and
// 2. this catalog: every entry of the saved sample answers in lib/sources/samples/,
//    converted with the SAME adapters search uses.
// The scoring itself is in lib/media/recommend.ts. Tested in catalog.test.ts.

import type { MediaResult } from "../media/types";
import { convertAniListResponse } from "./anilist";
import { convertIgdbResponse } from "./igdb";
import { dedupe } from "./merge";
import { convertOpenLibraryResponse } from "./openlibrary";
import aniListSample from "./samples/anilist-search.json";
import igdbSample from "./samples/igdb-games.json";
import openLibrarySample from "./samples/openlibrary-search.json";
import tmdbMovieSample from "./samples/tmdb-search-movie.json";
import tmdbTvSample from "./samples/tmdb-search-tv.json";
import { convertTmdbMovieResponse, convertTmdbTvResponse } from "./tmdb";

let cached: MediaResult[] | null = null;

/**
 * Every sample entry as a MediaResult, without duplicates: TMDB's "Spirited Away"
 * movie and AniList's "Spirited Away" anime become ONE anime, like in search
 * (dedupe from ./merge.ts). Worked out once, then remembered.
 */
export function sampleCatalog(): MediaResult[] {
  // `??=` = "only if it's still null": the conversion runs on the first call only.
  cached ??= dedupe([
    ...convertTmdbMovieResponse(tmdbMovieSample),
    ...convertTmdbTvResponse(tmdbTvSample),
    ...convertAniListResponse(aniListSample),
    ...convertOpenLibraryResponse(openLibrarySample),
    ...convertIgdbResponse(igdbSample),
  ]);
  return cached;
}
