// SERVER ONLY. The one place that reads the TMDB key from the environment.
//
// `import "server-only"` makes the build fail if a "use client" file ever
// imports this module, so the key can't end up in the browser by accident.
// (Next.js handles this import itself; there is nothing to install.)
// Also note the variable names have NO "NEXT_PUBLIC_" prefix: Next.js only
// copies NEXT_PUBLIC_ variables into browser code.
import "server-only";

import { createSampleMovieSearch, createTmdbMovieSearch, pickTmdbCredentials, type MovieSearch } from "./search";

export function getMovieSearch(): MovieSearch {
  // Read on every request (not once at startup), so a key added later works
  // after a restart of `npm run dev`, without changing code.
  const credentials = pickTmdbCredentials({
    TMDB_READ_ACCESS_TOKEN: process.env.TMDB_READ_ACCESS_TOKEN,
    TMDB_API_KEY: process.env.TMDB_API_KEY,
  });
  return credentials ? createTmdbMovieSearch(credentials) : createSampleMovieSearch();
}
