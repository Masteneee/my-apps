// A Route Handler: the URL /api/search?q=dune&type=all runs this code ON THE
// SERVER and answers with JSON (no page, no HTML).
// (In Stage 2 this was /api/movies/search, for movies only.)
//
// Why not call TMDB, AniList... straight from the browser? TMDB and IGDB need
// keys, and anything sent to the browser can be read by anyone (DevTools).
// Here the keys stay on the server: the browser asks us, we ask the sources.

import { getSourceEntries } from "@/lib/sources/server";
import { parseSearchFilter, type UnifiedSearchResponse } from "@/lib/sources/types";
import { unifiedSearch } from "@/lib/sources/unified";

export async function GET(request: Request) {
  // Reading request.url makes Next.js run this on every request (never cached at build).
  const params = new URL(request.url).searchParams;
  const answer = await unifiedSearch(params.get("q") ?? "", parseSearchFilter(params.get("type")), getSourceEntries());
  // unifiedSearch never throws: a failing source shows up in answer.sources
  // with state "error" and a message written for users (never a key).
  return Response.json(answer satisfies UnifiedSearchResponse);
}
