// Small pure helpers that turn stored data into what the pages show.
// No React here, so they're easy to test (display.test.ts).

import { formatProgress } from "./progress";
import { MEDIA_TYPES, type LogStatus, type LogWithMedia, type MediaType } from "./types";

/** 3.5 -> "★★★½". Null (not rated) -> "". */
export function ratingToStars(rating: number | null): string {
  if (rating === null) return "";
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return "★".repeat(full) + (half ? "½" : "");
}

/** The name of each media type, for one item and for several. */
export const TYPE_LABELS: Record<MediaType, { one: string; many: string }> = {
  movie: { one: "Movie", many: "Movies" },
  series: { one: "Series", many: "Series" },
  anime: { one: "Anime", many: "Anime" },
  manga: { one: "Manga", many: "Manga" },
  book: { one: "Book", many: "Books" },
  game: { one: "Game", many: "Games" },
};

/** The words that change with the kind of media: you WATCH a movie, READ a book, PLAY a game. */
export type MediaWords = {
  statuses: Record<LogStatus, string>;
  finishedOn: string; // label of the date field
  again: string; // label of the "rewatch" checkbox
};

const WATCH: MediaWords = {
  statuses: { planned: "Want to watch", in_progress: "Watching", completed: "Watched", dropped: "Dropped", paused: "Paused" },
  finishedOn: "Watched on",
  again: "I've seen it before (rewatch)",
};
const READ: MediaWords = {
  statuses: { planned: "Want to read", in_progress: "Reading", completed: "Read", dropped: "Dropped", paused: "Paused" },
  finishedOn: "Finished on",
  again: "I've read it before (reread)",
};
const PLAY: MediaWords = {
  statuses: { planned: "Want to play", in_progress: "Playing", completed: "Finished", dropped: "Dropped", paused: "Paused" },
  finishedOn: "Finished on",
  again: "I've played it before (replay)",
};

// Record<MediaType, ...> makes TypeScript complain if a new type is added without words.
const WORDS_BY_TYPE: Record<MediaType, MediaWords> = {
  movie: WATCH,
  series: WATCH,
  anime: WATCH,
  manga: READ,
  book: READ,
  game: PLAY,
};

export function wordsFor(type: MediaType): MediaWords {
  return WORDS_BY_TYPE[type];
}

/** "completed" -> "Watched" for a movie, "Read" for a book, "Finished" for a game. */
export function statusLabel(status: LogStatus, type: MediaType): string {
  return WORDS_BY_TYPE[type].statuses[status];
}

// What `total_units` counts for each type (null = nothing to count).
const UNIT_WORDS: Record<MediaType, [string, string] | null> = {
  movie: null,
  series: ["episode", "episodes"],
  anime: ["episode", "episodes"],
  manga: ["chapter", "chapters"],
  book: ["page", "pages"],
  game: null,
};

/** 24 for an anime -> "24 episodes", 1 -> "1 episode". Null when unknown or not counted. */
export function unitsLabel(type: MediaType, totalUnits: number | null): string | null {
  const words = UNIT_WORDS[type];
  if (!words || totalUnits === null) return null;
  return `${totalUnits} ${totalUnits === 1 ? words[0] : words[1]}`;
}

/**
 * You can log the same item several times (a rewatch is a new diary entry).
 * The poster grid should show each item once, with your MOST RECENT log.
 * Expects `logs` newest first (that's what getLogsForUser returns).
 */
export function latestLogPerItem(logs: LogWithMedia[]): LogWithMedia[] {
  const seen = new Set<string>();
  const result: LogWithMedia[] = [];
  for (const log of logs) {
    if (seen.has(log.media_item_id)) continue; // already have a newer log for it
    seen.add(log.media_item_id);
    result.push(log);
  }
  return result;
}

/** How many DIFFERENT items of each type someone logged (rewatches count once). */
export function countByType(logs: LogWithMedia[]): Record<MediaType, number> {
  // Start every type at 0 so the profile can show "0 Books" too.
  const counts = Object.fromEntries(MEDIA_TYPES.map((type) => [type, 0])) as Record<MediaType, number>;
  for (const log of latestLogPerItem(logs)) {
    counts[log.media.type] += 1;
  }
  return counts;
}

/**
 * Splits logs into one group per media type (Movies, Series, Anime...), in
 * the usual type order, skipping empty types. Each group keeps the logs' order.
 */
export function groupByType(logs: LogWithMedia[]): { type: MediaType; logs: LogWithMedia[] }[] {
  return MEDIA_TYPES.map((type) => ({ type, logs: logs.filter((log) => log.media.type === type) })).filter(
    (group) => group.logs.length > 0,
  );
}

/**
 * The progress of a log as text ("Episode 7/24", "45%", "12.5 hours"), or null
 * when there's nothing to show (no progress, or still "Want to watch").
 */
export function logProgressLabel(log: LogWithMedia): string | null {
  if (log.status === "planned") return null;
  return formatProgress(log.progress, log.progress_unit, log.media.total_units);
}

export type AverageRating = {
  average: number | null; // null when nobody rated it
  count: number; // how many PEOPLE rated it
};

/**
 * "Everyone's average rating" on an item page.
 * Each person counts ONCE, with their most recent rating: if you rated a movie 3
 * and then 4.5 on a rewatch, your 4.5 counts and your 3 doesn't. Otherwise
 * someone who logs a movie ten times would weigh ten times more.
 * Expects `logs` newest first (that's what getLogsForItem returns).
 */
export function averageRating(logs: LogWithMedia[]): AverageRating {
  const latestByUser = new Map<string, number>();
  for (const log of logs) {
    if (log.rating === null || latestByUser.has(log.user_id)) continue;
    latestByUser.set(log.user_id, log.rating);
  }
  const ratings = [...latestByUser.values()];
  if (ratings.length === 0) return { average: null, count: 0 };
  const sum = ratings.reduce((total, rating) => total + rating, 0);
  return { average: sum / ratings.length, count: ratings.length };
}

/** 3.8333 -> "3.8", 4 -> "4.0" (always one decimal, so averages line up). */
export function formatAverage(average: number): string {
  return average.toFixed(1);
}
