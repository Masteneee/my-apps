// Stage 6: rule-based, explainable cross-media recommendations, and "bridge picks".
// No AI model: every pick comes with the one rule that chose it, e.g.
// "Because you rated Interstellar 5★: shares Sci-Fi, Adventure".
// Pure functions (no store, no React), tested in recommend.test.ts.
//
// THE RULES
// 1. Your FAVORITES are the items whose latest rating is 4★ or more.
// 2. A CANDIDATE is any item in the pool (our database + the saved samples)
//    that you haven't logged yet (any status).
// 3. A favorite can only recommend a candidate of ANOTHER media type
//    (a movie recommends anime, books, games... never another movie).
// 4. Score = (shared tag points) × (favorite's rating − 3).
//    Each shared tag is 1 point, except the 4 BROAD tags (Drama, Action, Adventure,
//    Comedy): half a point, because almost everything has one, so sharing it says little.
//    The rating part makes a 5★ favorite count twice as much as a 4★ one (2 vs 1).
//    A candidate keeps its BEST score, and that favorite becomes "the reason".
// 5. Highest score first. Ties: the one that matches more of your favorites,
//    then by title (A to Z), so the order never changes randomly.

import { latestLogPerItem } from "./display";
import { genresToTags, tagListLabel, type Tag } from "./tags";
import type { LogWithMedia, MediaItem, MediaResult, MediaSource, MediaType } from "./types";
import { mediaItemToResult } from "./validation";

/** The types most people already use apps for. */
export const MAINSTREAM_TYPES: readonly MediaType[] = ["movie", "series", "book"];
/** The types this app wants to bring to more people (PLAN.md: "the bigger mission"). */
export const NICHE_TYPES: readonly MediaType[] = ["anime", "manga", "game"];

/** A favorite needs at least this rating. */
export const FAVORITE_MIN_RATING = 4;

/** Tags so common that sharing one says little: they count half (rule 4). */
export const BROAD_TAGS: readonly Tag[] = ["drama", "action", "adventure", "comedy"];

/** What one shared tag is worth: 0.5 for a broad tag, 1 for the others. */
export function tagPoints(tag: Tag): number {
  return BROAD_TAGS.includes(tag) ? 0.5 : 1;
}

type ItemRef = { type: MediaType; source: MediaSource; source_id: string };

/** One text that names an item everywhere: "anime:anilist:329". Same rule as the database's unique key. */
export function mediaItemKey(item: ItemRef): string {
  return `${item.type}:${item.source}:${item.source_id}`;
}

/** The same key for a search result (camelCase sourceId). */
export function mediaResultKey(result: MediaResult): string {
  return mediaItemKey({ type: result.type, source: result.source, source_id: result.sourceId });
}

/**
 * Items cached before Stage 6 have no genres ([]). If the same item is in the
 * catalog (the saved samples), borrow its genres; otherwise keep it as it is.
 * Returns a NEW object, never changes the one it was given.
 */
export function fillGenres<T extends ItemRef & { genres: string[] }>(item: T, catalog: readonly MediaResult[]): T {
  if (item.genres.length > 0) return item;
  const key = mediaItemKey(item);
  const match = catalog.find((result) => mediaResultKey(result) === key);
  return match && match.genres.length > 0 ? { ...item, genres: match.genres } : item;
}

/** The same for every log's item (what the stats and recommendations read). */
export function fillLogGenres(logs: LogWithMedia[], catalog: readonly MediaResult[]): LogWithMedia[] {
  return logs.map((log) => {
    const media = fillGenres(log.media, catalog);
    return media === log.media ? log : { ...log, media };
  });
}

/** Something we could recommend. `mediaItemId` is null when it's only in the samples (nobody logged it yet). */
export type Candidate = {
  media: MediaResult;
  mediaItemId: string | null;
  tags: Tag[];
};

/**
 * The pool: our database's items first (they have an item page), then the
 * catalog items that aren't in the database yet. Each item once.
 */
export function buildCandidatePool(dbItems: readonly MediaItem[], catalog: readonly MediaResult[]): Candidate[] {
  const pool: Candidate[] = [];
  const seen = new Set<string>();
  for (const item of dbItems) {
    const key = mediaItemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    const filled = fillGenres(item, catalog);
    pool.push({ media: mediaItemToResult(filled), mediaItemId: item.id, tags: genresToTags(filled.genres) });
  }
  for (const result of catalog) {
    const key = mediaResultKey(result);
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push({ media: result, mediaItemId: null, tags: genresToTags(result.genres) });
  }
  return pool;
}

/** Something you rated 4★ or more, with its tags. */
export type Favorite = {
  key: string;
  title: string;
  type: MediaType;
  rating: number;
  tags: Tag[];
};

/**
 * Your favorites: your LATEST log of each item (expects logs newest first, like
 * getLogsForUser), rated FAVORITE_MIN_RATING or more, with at least one tag.
 * Best rated first; equal ratings keep the newest first.
 */
export function favoritesFrom(logs: LogWithMedia[]): Favorite[] {
  return latestLogPerItem(logs)
    .filter((log) => log.rating !== null && log.rating >= FAVORITE_MIN_RATING)
    .map((log) => ({
      key: mediaItemKey(log.media),
      title: log.media.title,
      type: log.media.type,
      rating: log.rating as number, // not null: filtered just above
      tags: genresToTags(log.media.genres),
    }))
    .filter((favorite) => favorite.tags.length > 0)
    .sort((a, b) => b.rating - a.rating); // sort is stable: same rating = newest first
}

export type Recommendation = {
  candidate: Candidate;
  /** The favorite that gave the best score: the reason we show. */
  because: Favorite;
  /** The tags the candidate shares with `because`, most specific first. */
  sharedTags: Tag[];
  score: number;
  /** How many of your favorites (of another type) share at least one tag with it. */
  favoritesMatched: number;
};

/** Rule 4: how much one favorite likes one candidate. 0 = no shared tag, or same type (rule 3). */
export function pairScore(favorite: Favorite, candidate: Candidate): { score: number; sharedTags: Tag[] } {
  if (favorite.type === candidate.media.type) return { score: 0, sharedTags: [] };
  const sharedTags = candidate.tags.filter((tag) => favorite.tags.includes(tag));
  const points = sharedTags.reduce((sum, tag) => sum + tagPoints(tag), 0);
  return { score: points * (favorite.rating - 3), sharedTags };
}

/** The best reason to recommend this candidate, or null if no favorite matches it. */
export function scoreCandidate(candidate: Candidate, favorites: readonly Favorite[]): Recommendation | null {
  let best: Recommendation | null = null;
  let matched = 0;
  for (const favorite of favorites) {
    const { score, sharedTags } = pairScore(favorite, candidate);
    if (score <= 0) continue;
    matched += 1;
    // ">" (not ">="): on a tie the EARLIER favorite wins (better rated, or newer).
    if (!best || score > best.score) best = { candidate, because: favorite, sharedTags, score, favoritesMatched: 0 };
  }
  return best && { ...best, favoritesMatched: matched };
}

/** Rule 5: the order of the recommendations. */
export function compareRecommendations(a: Recommendation, b: Recommendation): number {
  return (
    b.score - a.score ||
    b.favoritesMatched - a.favoritesMatched ||
    a.candidate.media.title.localeCompare(b.candidate.media.title)
  );
}

export type RecommendOptions = {
  /** The most to return. Default 12. */
  limit?: number;
  /** Only favorites of these types count (default: every type). */
  fromTypes?: readonly MediaType[];
  /** Only recommend these types (default: every type). */
  toTypes?: readonly MediaType[];
};

/** The whole recipe: favorites, candidates you haven't logged, score, sort, cut. */
export function recommend(
  logs: LogWithMedia[],
  pool: readonly Candidate[],
  options: RecommendOptions = {},
): Recommendation[] {
  const { limit = 12, fromTypes, toTypes } = options;
  const favorites = favoritesFrom(logs).filter((f) => !fromTypes || fromTypes.includes(f.type));
  if (favorites.length === 0) return [];
  // Anything you logged, even "want to watch", is already on your radar.
  const logged = new Set(logs.map((log) => mediaItemKey(log.media)));

  return pool
    .filter((candidate) => !toTypes || toTypes.includes(candidate.media.type))
    .filter((candidate) => !logged.has(mediaResultKey(candidate.media)))
    .map((candidate) => scoreCandidate(candidate, favorites))
    .filter((rec): rec is Recommendation => rec !== null)
    .sort(compareRecommendations)
    .slice(0, limit);
}

/** 5 -> "5★", 4.5 -> "4.5★". */
export function ratingLabel(rating: number): string {
  return `${rating}★`;
}

/** "Because you rated Interstellar 5★: shares Sci-Fi, Adventure". */
export function reasonText(rec: Recommendation): string {
  return `Because you rated ${rec.because.title} ${ratingLabel(rec.because.rating)}: shares ${tagListLabel(rec.sharedTags)}`;
}

// ---------------------------------------------------------------------------
// Bridge picks: niche items (anime, manga, games) for people who mostly log
// mainstream media (movies, series, books).
// ---------------------------------------------------------------------------

/** You need at least this many different items logged... */
export const BRIDGE_MIN_ITEMS = 3;
/** ...and at least this share of them must be movies, series or books (3 out of 4). */
export const BRIDGE_MIN_MAINSTREAM_SHARE = 0.75;

export type BridgeAudience = {
  /** "ok" = show bridge picks. "too-few" = log more first. "already-niche" = you already log plenty of niche media. */
  status: "ok" | "too-few" | "already-niche";
  items: number;
  mainstreamItems: number;
};

/**
 * THE BRIDGE RULE: you're a "mainstream user" when you logged at least 3
 * different things, and at least 75% of them are movies, series or books.
 * Every status counts ("want to watch" too): it's about what you pay attention to.
 */
export function bridgeAudience(logs: LogWithMedia[]): BridgeAudience {
  const items = latestLogPerItem(logs);
  const mainstreamItems = items.filter((log) => MAINSTREAM_TYPES.includes(log.media.type)).length;
  let status: BridgeAudience["status"] = "ok";
  if (items.length < BRIDGE_MIN_ITEMS) status = "too-few";
  else if (mainstreamItems / items.length < BRIDGE_MIN_MAINSTREAM_SHARE) status = "already-niche";
  return { status, items: items.length, mainstreamItems };
}

/**
 * Takes the best pick of each media type first (so you see an anime, a manga
 * AND a game side by side, not three anime), then fills up with the rest.
 * Expects `recs` already sorted best first; keeps that order among the picks.
 */
export function spreadByType(recs: readonly Recommendation[], limit: number): Recommendation[] {
  const firstOfType = recs.filter(
    (rec, index) => recs.findIndex((other) => other.candidate.media.type === rec.candidate.media.type) === index,
  );
  const rest = recs.filter((rec) => !firstOfType.includes(rec));
  return [...firstOfType, ...rest].slice(0, limit);
}

export const BRIDGE_PICKS_LIMIT = 3;

/**
 * Bridge picks: only from your MAINSTREAM favorites, only NICHE candidates, spread
 * over the niche types. Empty unless bridgeAudience(logs).status is "ok".
 */
export function bridgePicks(
  logs: LogWithMedia[],
  pool: readonly Candidate[],
  limit = BRIDGE_PICKS_LIMIT,
): Recommendation[] {
  if (bridgeAudience(logs).status !== "ok") return [];
  const recs = recommend(logs, pool, { fromTypes: MAINSTREAM_TYPES, toTypes: NICHE_TYPES, limit: Infinity });
  return spreadByType(recs, limit);
}
