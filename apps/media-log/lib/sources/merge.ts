// Merging the answers of several sources into ONE list. Pure functions (no
// network, no React), so every rule here is tested in merge.test.ts.
//
// Three steps, in this order:
// 1. interleaveByType: take turns between media types, so 20 movies can't
//    push every game and book to the bottom.
// 2. dedupe: the same thing found twice becomes one result.
// 3. rankByTitleMatch: exact title matches first, then "starts with", etc.

import { MEDIA_TYPES, type MediaResult, type MediaType } from "../media/types";
import { normalizeText } from "./shared";

/**
 * Takes the 1st result of each type, then the 2nd of each type, and so on
 * (like dealing cards). Inside one type, the source's own order is kept.
 */
export function interleaveByType(results: MediaResult[]): MediaResult[] {
  const groups = MEDIA_TYPES.map((type) => results.filter((result) => result.type === type));
  const longest = Math.max(0, ...groups.map((group) => group.length));
  const dealt: MediaResult[] = [];
  for (let i = 0; i < longest; i++) {
    for (const group of groups) {
      if (i < group.length) dealt.push(group[i]);
    }
  }
  return dealt;
}

/** Every way a result can be written, normalized: "Your Name." and "君の名は。". */
function titleKeys(result: MediaResult): string[] {
  return [result.title, result.originalTitle].map(normalizeText).filter((key) => key !== "");
}

// An anime can also be in TMDB, as a movie (Spirited Away) or a series
// (Attack on Titan). Those are the only two kinds that can be "the same
// thing" across types. A manga and its anime are NOT the same thing.
const SCREEN_TYPES: MediaType[] = ["movie", "series"];

function typesCanMatch(a: MediaType, b: MediaType): boolean {
  if (a === b) return true;
  return (a === "anime" && SCREEN_TYPES.includes(b)) || (b === "anime" && SCREEN_TYPES.includes(a));
}

function shareACreator(a: MediaResult, b: MediaResult): boolean {
  const names = new Set(a.creators.map(normalizeText));
  return b.creators.some((name) => names.has(normalizeText(name)));
}

/**
 * Are these two results the same real thing?
 * - Same source, type and id: yes, obviously.
 * - Otherwise their types must be able to match, and they must share a title
 *   (any of title / original title, ignoring case, accents and punctuation), AND
 *   - the same year (Dune 1984 and Dune 2021 are two different films), or
 *   - for the same type, when a year is missing: a creator in common
 *     (two Open Library entries "Dune" by Frank Herbert, one without a year).
 */
export function isSameItem(a: MediaResult, b: MediaResult): boolean {
  if (a.source === b.source && a.type === b.type && a.sourceId === b.sourceId) return true;
  if (!typesCanMatch(a.type, b.type)) return false;

  const keysOfA = new Set(titleKeys(a));
  if (!titleKeys(b).some((key) => keysOfA.has(key))) return false;

  if (a.year !== null && b.year !== null) return a.year === b.year;
  // A year is missing: only trust it for the same type with a creator in common.
  return a.type === b.type && shareACreator(a, b);
}

/**
 * When two results are the same thing, which one do we show?
 * The anime version beats the TMDB movie/series version (it has the episode
 * count and the studio). Otherwise, the one we saw first wins.
 */
function pickWinner(first: MediaResult, second: MediaResult): [MediaResult, MediaResult] {
  if (second.type === "anime" && first.type !== "anime") return [second, first];
  return [first, second];
}

/** The winner, with any blanks filled in from the other copy (cover, year, summary...). */
export function combine(first: MediaResult, second: MediaResult): MediaResult {
  const [winner, other] = pickWinner(first, second);
  return {
    ...winner,
    // `??` = "use the right side only if the left side is null/undefined".
    originalTitle: winner.originalTitle ?? (other.originalTitle !== winner.title ? other.originalTitle : null),
    year: winner.year ?? other.year,
    coverUrl: winner.coverUrl ?? other.coverUrl,
    creators: winner.creators.length > 0 ? winner.creators : other.creators,
    // Only borrow a count from the same type: pages and episodes can't be mixed.
    totalUnits: winner.totalUnits ?? (winner.type === other.type ? other.totalUnits : null),
    overview: winner.overview ?? other.overview,
    // Stage 6: same rule as creators (the winner's own words, unless it has none).
    genres: winner.genres.length > 0 ? winner.genres : other.genres,
  };
}

/** Keeps one result per real thing, in the order they first appeared. */
export function dedupe(results: MediaResult[]): MediaResult[] {
  const kept: MediaResult[] = [];
  for (const result of results) {
    const index = kept.findIndex((existing) => isSameItem(existing, result));
    if (index === -1) {
      kept.push(result);
    } else {
      // Replace it in the same spot, so the list order doesn't jump around.
      kept[index] = combine(kept[index], result);
    }
  }
  return kept;
}

/**
 * How well a result's title matches what was typed:
 * 3 = exactly ("dune" -> "Dune"), 2 = starts with it ("Dune: Part Two"),
 * 1 = contains it as a whole word ("Children of Dune"), 0 = only matched
 * in some other way (an author's name, a synonym...).
 */
export function matchScore(query: string, result: MediaResult): number {
  const wanted = normalizeText(query);
  if (!wanted) return 0;
  let best = 0;
  for (const key of titleKeys(result)) {
    if (key === wanted) best = Math.max(best, 3);
    else if (key.startsWith(`${wanted} `)) best = Math.max(best, 2);
    else if (` ${key} `.includes(` ${wanted} `)) best = Math.max(best, 1);
  }
  return best;
}

/**
 * Best title matches first. JavaScript's sort is "stable": results with the
 * same score keep their order from interleaveByType.
 */
export function rankByTitleMatch(results: MediaResult[], query: string): MediaResult[] {
  return [...results].sort((a, b) => matchScore(query, b) - matchScore(query, a));
}

/** The whole recipe: interleave, then dedupe, then rank. */
export function mergeResults(results: MediaResult[], query: string): MediaResult[] {
  return rankByTitleMatch(dedupe(interleaveByType(results)), query);
}
