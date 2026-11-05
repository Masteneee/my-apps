// A Route Handler: the URL /api/movies/search?q=interstellar runs this code
// ON THE SERVER and answers with JSON (no page, no HTML).
//
// Why not call TMDB straight from the browser? The browser would need the TMDB
// key, and anything sent to the browser can be read by anyone (DevTools).
// Here the key stays on the server: the browser asks us, we ask TMDB.

import type { MovieSearchResponse } from "@/lib/tmdb/search";
import { getMovieSearch } from "@/lib/tmdb/server";

export async function GET(request: Request) {
  // Reading request.url makes Next.js run this on every request (never cached at build).
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const movieSearch = getMovieSearch();

  try {
    const results = await movieSearch.search(query);
    return Response.json({ results, usesSample: movieSearch.usesSample } satisfies MovieSearchResponse);
  } catch (err) {
    // The error messages from lib/tmdb/search.ts are written for users, and
    // never contain the key. 502 = "the service behind me failed".
    const message = err instanceof Error ? err.message : "Search failed. Try again.";
    return Response.json({ results: [], usesSample: movieSearch.usesSample, error: message } satisfies MovieSearchResponse, {
      status: 502,
    });
  }
}
