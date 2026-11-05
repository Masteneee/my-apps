// IGDB adapter: video games. IGDB belongs to Twitch, so its key is a Twitch
// developer "client id" + "client secret" (dev.twitch.tv/console).
//
// Using IGDB takes TWO steps:
// 1. Trade the client id + secret for an "access token" at Twitch
//    (a temporary password, valid for about 60 days).
// 2. Search IGDB with the client id + that token.
// We keep the token in memory and reuse it until it's about to expire,
// instead of asking Twitch for a new one on every search.
//
// Two versions behind the SourceAdapter contract, like every adapter:
// createIgdbSource (real API) and createIgdbSampleSource (saved sample).

import type { MediaResult } from "../media/types";
import sample from "./samples/igdb-games.json";
import {
  cleanQuery,
  cleanText,
  cleanTitle,
  cleanYear,
  fetchJson,
  matchesQuery,
  SourceError,
  uniqueNames,
} from "./shared";
import type { SourceAdapter } from "./types";

// ---------------------------------------------------------------------------
// IGDB's own shapes (from api-docs.igdb.com). Only the fields we ask for
// come back, and missing values are left out entirely (no nulls).
// ---------------------------------------------------------------------------

export type IgdbGame = {
  id: number;
  name: string;
  first_release_date?: number; // a Unix timestamp: SECONDS since 1 Jan 1970 (UTC)
  summary?: string;
  cover?: { id: number; image_id: string };
  involved_companies?: { id: number; developer: boolean; company: { id: number; name: string } }[];
};

/** IGDB answers with a plain list of games (no wrapper object). */
export type IgdbSearchResponse = IgdbGame[];

export type TwitchTokenResponse = { access_token: string; expires_in: number; token_type: string };

// ---------------------------------------------------------------------------
// Converting IGDB's answers into MediaResult
// ---------------------------------------------------------------------------

// t_cover_big = 264 x 374 pixels, the same 2:3 shape as our posters.
export const IGDB_IMAGE_BASE = "https://images.igdb.com/igdb/image/upload/t_cover_big/";

export function igdbCoverUrl(cover: IgdbGame["cover"]): string | null {
  return cover?.image_id ? `${IGDB_IMAGE_BASE}${cover.image_id}.jpg` : null;
}

/** 1431993600 (seconds) -> 2015. JavaScript dates count MILLISECONDS, hence * 1000. */
export function yearFromUnixSeconds(seconds: number | undefined): number | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  return cleanYear(new Date(seconds * 1000).getUTCFullYear());
}

export function igdbGameToMediaResult(game: IgdbGame): MediaResult {
  const companies = game.involved_companies ?? [];
  // The studio that MADE the game, not the one that sold it. If IGDB doesn't
  // say who the developer is, fall back to every company listed.
  const developers = companies.filter((c) => c.developer);
  return {
    type: "game",
    source: "igdb",
    sourceId: String(game.id),
    title: cleanTitle(game.name) ?? "Untitled",
    originalTitle: null,
    year: yearFromUnixSeconds(game.first_release_date),
    coverUrl: igdbCoverUrl(game.cover),
    creators: uniqueNames((developers.length ? developers : companies).map((c) => c.company?.name), 2),
    totalUnits: null, // games have no episodes or pages; Stage 4 tracks hours instead
    overview: cleanText(game.summary),
  };
}

function looksLikeGame(value: unknown): value is IgdbGame {
  if (typeof value !== "object" || value === null) return false;
  const game = value as Record<string, unknown>;
  return typeof game.id === "number" && typeof game.name === "string";
}

export function convertIgdbResponse(json: unknown): MediaResult[] {
  return Array.isArray(json) ? json.filter(looksLikeGame).map(igdbGameToMediaResult) : [];
}

// ---------------------------------------------------------------------------
// The real API
// ---------------------------------------------------------------------------

export const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
export const IGDB_GAMES_URL = "https://api.igdb.com/v4/games";
export const IGDB_KEY_HINT = "IGDB_CLIENT_ID / IGDB_CLIENT_SECRET";

export type IgdbCredentials = { clientId: string; clientSecret: string };

/** Both values are needed. Null = "use the sample". */
export function pickIgdbCredentials(env: { IGDB_CLIENT_ID?: string; IGDB_CLIENT_SECRET?: string }): IgdbCredentials | null {
  const clientId = env.IGDB_CLIENT_ID?.trim();
  const clientSecret = env.IGDB_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export type TokenProvider = {
  /** A valid token (asks Twitch only when we have none or it's about to expire). */
  get(): Promise<string>;
  /** Forget the saved token (after IGDB refuses it), so the next get() asks again. */
  forget(): void;
};

/**
 * Gets and remembers the Twitch token. `now` is a parameter so tests can
 * move the clock forward and check the token is renewed.
 */
export function createTwitchTokenProvider(
  credentials: IgdbCredentials,
  fetchFn: typeof fetch = fetch,
  now: () => number = Date.now,
): TokenProvider {
  let saved: { token: string; expiresAt: number } | null = null;
  return {
    async get() {
      // Renew one minute early, so a token can't expire in the middle of a search.
      if (saved && now() < saved.expiresAt - 60_000) return saved.token;
      const params = new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        grant_type: "client_credentials",
      });
      const json = (await fetchJson(
        fetchFn,
        `${TWITCH_TOKEN_URL}?${params.toString()}`,
        { method: "POST" },
        // Twitch answers 400 or 403 for a wrong id or secret.
        { label: "Twitch (for IGDB)", refusedStatuses: [400, 401, 403], keyHint: IGDB_KEY_HINT },
      )) as Partial<TwitchTokenResponse>;
      if (typeof json.access_token !== "string" || typeof json.expires_in !== "number") {
        throw new SourceError("Twitch sent an answer we couldn't read. Try again later.", "bad-answer");
      }
      saved = { token: json.access_token, expiresAt: now() + json.expires_in * 1000 };
      return saved.token;
    },
    forget() {
      saved = null;
    },
  };
}

/**
 * IGDB's own query language ("Apicalypse"): one instruction per line, each
 * ending with ";". The search text sits between double quotes, so a quote
 * inside it must be "escaped" (\") or it would end the text early.
 */
export function buildIgdbQuery(query: string, limit: number): string {
  const escaped = query.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return [
    `search "${escaped}";`,
    "fields name,first_release_date,summary,cover.image_id,involved_companies.developer,involved_companies.company.name;",
    // version_parent = null: skip "Deluxe/GOTY edition" copies of the same game.
    // themes != (42): skip adult games (theme 42 is "Erotic").
    "where version_parent = null & themes != (42);",
    `limit ${limit};`,
  ].join("\n");
}

export function createIgdbSource(
  credentials: IgdbCredentials,
  fetchFn: typeof fetch = fetch,
  tokens: TokenProvider = createTwitchTokenProvider(credentials, fetchFn),
): SourceAdapter {
  return {
    source: "igdb",
    label: "IGDB",
    types: ["game"],
    mode: "live",
    async search(rawQuery, { types, limit }) {
      const query = cleanQuery(rawQuery);
      if (!query || !types.includes("game")) return [];
      const token = await tokens.get();
      try {
        const json = await fetchJson(
          fetchFn,
          IGDB_GAMES_URL,
          {
            method: "POST",
            headers: {
              "client-id": credentials.clientId,
              authorization: `Bearer ${token}`,
              accept: "application/json",
              "content-type": "text/plain",
            },
            body: buildIgdbQuery(query, limit),
          },
          { label: "IGDB", keyHint: IGDB_KEY_HINT },
        );
        return convertIgdbResponse(json);
      } catch (err) {
        // A refused token may just be expired early: forget it so the next search gets a new one.
        if (err instanceof SourceError && err.kind === "refused") tokens.forget();
        throw err;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// The saved sample
// ---------------------------------------------------------------------------

/** Searches the saved sample and answers in IGDB's own shape (a list of games). */
export function searchIgdbSample(query: string, limit: number): IgdbSearchResponse {
  return (sample as IgdbSearchResponse).filter((game) => matchesQuery(cleanQuery(query), [game.name])).slice(0, limit);
}

export function createIgdbSampleSource(): SourceAdapter {
  return {
    source: "igdb",
    label: "IGDB",
    types: ["game"],
    mode: "sample",
    async search(query, { types, limit }) {
      if (!cleanQuery(query) || !types.includes("game")) return [];
      return convertIgdbResponse(searchIgdbSample(query, limit));
    },
  };
}
