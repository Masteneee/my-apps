// SERVER ONLY. The one place that reads the source keys from the environment.
//
// `import "server-only"` makes the build fail if a "use client" file ever
// imports this module, so the keys can't end up in the browser by accident.
// (Next.js handles this import itself; there is nothing to install.)
// Also note the variable names have NO "NEXT_PUBLIC_" prefix: Next.js only
// copies NEXT_PUBLIC_ variables into browser code.
import "server-only";

import { createTwitchTokenProvider, type IgdbCredentials, type TokenProvider } from "./igdb";
import { createSourceEntries } from "./setup";
import type { SourceEntry } from "./unified";

// The IGDB token lives here, OUTSIDE the function, so it survives from one
// search to the next (a module is loaded once per server process).
let igdbTokens: { clientId: string; provider: TokenProvider } | null = null;

function igdbTokenProviderFor(credentials: IgdbCredentials): TokenProvider {
  // A new client id (you changed .env.local) gets a new provider.
  if (igdbTokens?.clientId !== credentials.clientId) {
    igdbTokens = { clientId: credentials.clientId, provider: createTwitchTokenProvider(credentials) };
  }
  return igdbTokens.provider;
}

export function getSourceEntries(): SourceEntry[] {
  // Read on every request (not once at startup), so a key added later works
  // after a restart of `npm run dev`, without changing code.
  return createSourceEntries(
    {
      TMDB_READ_ACCESS_TOKEN: process.env.TMDB_READ_ACCESS_TOKEN,
      TMDB_API_KEY: process.env.TMDB_API_KEY,
      IGDB_CLIENT_ID: process.env.IGDB_CLIENT_ID,
      IGDB_CLIENT_SECRET: process.env.IGDB_CLIENT_SECRET,
      MEDIA_LOG_USE_SAMPLES: process.env.MEDIA_LOG_USE_SAMPLES,
    },
    { igdbTokens: igdbTokenProviderFor },
  );
}
