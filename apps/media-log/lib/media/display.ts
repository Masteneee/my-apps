// Small pure helpers that turn stored data into what the pages show.
// No React here, so they're easy to test (display.test.ts).

import { MEDIA_TYPES, type LogStatus, type LogWithMedia, type MediaType } from "./types";

/** 3.5 -> "★★★½". Null (not rated) -> "". */
export function ratingToStars(rating: number | null): string {
  if (rating === null) return "";
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return "★".repeat(full) + (half ? "½" : "");
}

// Words for each status, as a movie fan would say them. Stage 3 will add
// words for other types ("Reading", "Playing"...).
export const MOVIE_STATUS_LABELS: Record<LogStatus, string> = {
  planned: "Want to watch",
  in_progress: "Watching",
  completed: "Watched",
  dropped: "Dropped",
  paused: "Paused",
};

/**
 * You can log the same movie several times (a rewatch is a new diary entry).
 * The poster grid should show each movie once, with your MOST RECENT log.
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
