// Stage 6: the numbers on the stats page /u/<username>/stats.
// Pure functions (plain arrays in, plain objects out), tested in stats.test.ts.
// The page just draws them as bars (components/StatsView.tsx).
//
// One rule everywhere: an ITEM counts once (your latest log of it, like the
// profile counters), but the yearly recap counts diary ENTRIES (a rewatch is a
// new entry), because a recap is about what you did that year.

import { diaryDate, monthLabel } from "./diary";
import { latestLogPerItem } from "./display";
import { genresToTags, TAGS, type Tag } from "./tags";
import { MEDIA_TYPES, type LogWithMedia, type MediaType } from "./types";
import { RATING_OPTIONS } from "./validation";

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

export type RatingBucket = { rating: number; count: number };

export type RatingDistribution = {
  /** One bucket per possible rating (0.5, 1, 1.5 ... 5), even empty ones, so the bars line up. */
  buckets: RatingBucket[];
  /** How many items have a rating. */
  rated: number;
  /** Their average, or null when nothing is rated. */
  average: number | null;
};

/** How many items got each rating (each item once: its latest log). */
export function ratingDistribution(logs: LogWithMedia[]): RatingDistribution {
  const ratings = latestLogPerItem(logs)
    .map((log) => log.rating)
    .filter((rating): rating is number => rating !== null);
  const buckets = RATING_OPTIONS.map((rating) => ({ rating, count: ratings.filter((r) => r === rating).length }));
  const sum = ratings.reduce((total, rating) => total + rating, 0);
  return { buckets, rated: ratings.length, average: ratings.length ? sum / ratings.length : null };
}

/** The biggest count among some bars (at least 1), so the longest bar can be 100% wide. */
export function maxCount(rows: readonly { count: number }[]): number {
  return Math.max(1, ...rows.map((row) => row.count));
}

/** A bar's width in %, e.g. 3 of 4 -> 75. A non-zero count always shows a sliver (at least 2%). */
export function barPercent(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.max(2, Math.round((count / max) * 100));
}

// ---------------------------------------------------------------------------
// Genres (as shared tags, see ./tags.ts)
// ---------------------------------------------------------------------------

export type TagCount = { tag: Tag; count: number };

/**
 * The tags you spend the most time with. Each item counts once, and items
 * you only WANT to see ("planned") don't count: they aren't your taste yet.
 * Most common first; ties in TAGS order (most specific first). At most `limit`.
 */
export function topTags(logs: LogWithMedia[], limit = 8): TagCount[] {
  const counts = new Map<Tag, number>();
  for (const log of latestLogPerItem(logs)) {
    if (log.status === "planned") continue;
    for (const tag of genresToTags(log.media.genres)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return TAGS.filter((tag) => counts.has(tag))
    .map((tag) => ({ tag, count: counts.get(tag)! })) // "!" = we just checked it's there
    .sort((a, b) => b.count - a.count) // stable: equal counts keep TAGS order
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Yearly recap
// ---------------------------------------------------------------------------

/** The years that have diary entries, newest first: [2026, 2025]. */
export function recapYears(logs: LogWithMedia[]): number[] {
  const years = new Set(logs.map((log) => Number(diaryDate(log).slice(0, 4))));
  return [...years].sort((a, b) => b - a);
}

export type YearRecap = {
  year: number;
  /** Diary entries that year (every log, rewatches and "want to watch" included). */
  entries: number;
  /** Entries marked finished (Watched / Read / Finished). */
  finished: number;
  /** Finished entries per media type, every type present (0 when none). */
  finishedByType: Record<MediaType, number>;
  /** Items rated that year (each once) and their average. */
  rated: number;
  averageRating: number | null;
  /** Up to 3 best-rated items that year; equal ratings: the most recent first. */
  topRated: LogWithMedia[];
  /** The most common tag that year (not counting "planned"), or null. */
  topTag: TagCount | null;
  /** The month with the most entries ("March 2026"), or null when the year is empty. Ties: the earlier month. */
  busiestMonth: { label: string; count: number } | null;
};

/** Everything the recap card shows for one year. Expects logs newest first (like getLogsForUser). */
export function yearlyRecap(logs: LogWithMedia[], year: number): YearRecap {
  const inYear = logs.filter((log) => diaryDate(log).startsWith(`${year}-`));

  const finishedLogs = inYear.filter((log) => log.status === "completed");
  const finishedByType = Object.fromEntries(MEDIA_TYPES.map((type) => [type, 0])) as Record<MediaType, number>;
  for (const log of finishedLogs) finishedByType[log.media.type] += 1;

  const ratings = ratingDistribution(inYear);
  const topRated = latestLogPerItem(inYear)
    .filter((log) => log.rating !== null)
    // Best first; for equal ratings, the most recent diary day first.
    .sort((a, b) => b.rating! - a.rating! || diaryDate(b).localeCompare(diaryDate(a)))
    .slice(0, 3);

  const months = new Map<string, number>();
  for (const log of inYear) {
    const month = diaryDate(log).slice(0, 7); // "2026-03"
    months.set(month, (months.get(month) ?? 0) + 1);
  }
  let busiestMonth: YearRecap["busiestMonth"] = null;
  for (const [month, count] of [...months].sort(([a], [b]) => a.localeCompare(b))) {
    if (!busiestMonth || count > busiestMonth.count) busiestMonth = { label: monthLabel(month), count };
  }

  return {
    year,
    entries: inYear.length,
    finished: finishedLogs.length,
    finishedByType,
    rated: ratings.rated,
    averageRating: ratings.average,
    topRated,
    topTag: topTags(inYear, 1)[0] ?? null,
    busiestMonth,
  };
}
