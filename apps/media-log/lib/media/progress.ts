// Progress tracking (Stage 4): "Episode 7/24", "Chapter 120/?", "45%", "12.5 hours".
// Pure functions only (no React, no database), so every rule is easy to test
// in progress.test.ts. Both stores and the pages use them.
//
// How progress is stored: two columns on a log.
//   progress       a number: 7 (episodes), 120 (chapters), 270 (pages), 45 (%), 12.5 (hours)
//   progress_unit  what that number counts: "episode", "chapter", "page", "percent", "hour"
// The total (24 episodes, 604 pages) is NOT on the log: it's the item's
// `total_units`, and it can be unknown (null), e.g. a manga that's still running.

import type { MediaType, ProgressUnit } from "./types";
import { PROGRESS_UNITS } from "./types";
import type { Result } from "./validation";

// Which units each media type can use. The FIRST one is the default.
// Movies have none: you watch a movie in one go (no "minute 47 of 169").
const UNITS_BY_TYPE: Record<MediaType, readonly ProgressUnit[]> = {
  movie: [],
  series: ["episode"],
  anime: ["episode"],
  manga: ["chapter"],
  book: ["page", "percent"], // paper book = pages, e-reader = percent
  game: ["hour"],
};

/** The units a media type can track (empty for movies). */
export function progressUnitsFor(type: MediaType): readonly ProgressUnit[] {
  return UNITS_BY_TYPE[type];
}

/** The unit used when you don't pick one: episodes for anime, pages for books... Null for movies. */
export function defaultProgressUnit(type: MediaType): ProgressUnit | null {
  return UNITS_BY_TYPE[type][0] ?? null;
}

export function isProgressUnit(value: unknown): value is ProgressUnit {
  return typeof value === "string" && (PROGRESS_UNITS as readonly string[]).includes(value);
}

/**
 * Episodes, chapters and pages count PARTS of the item, so they can be
 * compared with `total_units` ("7 of 24"). Percent and hours can't.
 */
export function countsParts(unit: ProgressUnit): boolean {
  return unit === "episode" || unit === "chapter" || unit === "page";
}

// A sanity limit so a typo like 1200000 is caught. KEEP IN SYNC with the migration.
export const PROGRESS_MAX = 100000;

/** Words for the form and the messages. */
export const UNIT_LABELS: Record<ProgressUnit, { one: string; many: string; short: string }> = {
  episode: { one: "episode", many: "episodes", short: "Episode" },
  chapter: { one: "chapter", many: "chapters", short: "Chapter" },
  page: { one: "page", many: "pages", short: "Page" },
  percent: { one: "percent", many: "percent", short: "%" },
  hour: { one: "hour", many: "hours", short: "Hours" },
};

// The label of the progress box in the forms.
const FIELD_LABELS: Record<MediaType, string> = {
  movie: "Progress", // never shown: movies have no progress
  series: "Episodes watched",
  anime: "Episodes watched",
  manga: "Chapters read",
  book: "How far are you?",
  game: "Hours played",
};

export function progressFieldLabel(type: MediaType): string {
  return FIELD_LABELS[type];
}

/**
 * What the user typed in the progress box -> a number for validateProgress().
 * "" (empty box) -> null = no progress. "7" -> 7. "12,5" -> 12.5 (French-style comma).
 * Anything else ("abc") becomes NaN, which validateProgress() refuses with a clear message.
 */
export function parseProgressText(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  return trimmed === "" ? null : Number(trimmed);
}

/** The cleaned progress, in database column names. Both null = "no progress". */
export type CleanProgress = { progress: number | null; progress_unit: ProgressUnit | null };

/**
 * Checks a progress value for one item. `total` is the item's total_units
 * (null = unknown). Returns the cleaned value or a sentence for the user.
 *
 * Rules:
 * - empty (null) is always fine: no progress
 * - movies have no progress
 * - the unit must fit the type (no "hours" for a book)
 * - 0 or more; whole numbers, except hours (one decimal: 12.5)
 * - percent at most 100; episodes/chapters/pages at most the total, when it's known
 */
export function validateProgress(
  type: MediaType,
  progress: unknown,
  unit: unknown,
  total: number | null,
): Result<CleanProgress> {
  if (progress === null || progress === undefined) return { ok: true, value: { progress: null, progress_unit: null } };

  const allowed = progressUnitsFor(type);
  if (allowed.length === 0) return { ok: false, error: "Movies don't have progress to track." };

  // No unit given = the type's default (a form for an anime doesn't need to ask).
  const chosen = unit === null || unit === undefined ? allowed[0] : unit;
  if (!isProgressUnit(chosen) || !allowed.includes(chosen)) {
    return { ok: false, error: "That kind of progress doesn't fit this item." };
  }

  if (typeof progress !== "number" || !Number.isFinite(progress)) {
    return { ok: false, error: "The progress must be a number." };
  }
  if (progress < 0) return { ok: false, error: "The progress can't be negative." };
  if (progress > PROGRESS_MAX) return { ok: false, error: "That progress is too big. Check for a typo." };

  let value = progress;
  if (chosen === "hour") {
    // One decimal is enough for hours (12.5). We round instead of refusing,
    // because 0.1 + 0.2 = 0.30000000000000004 in JavaScript (floats aren't exact).
    value = Math.round(progress * 10) / 10;
  } else if (!Number.isInteger(progress)) {
    return { ok: false, error: `Use a whole number of ${UNIT_LABELS[chosen].many}.` };
  }

  if (chosen === "percent" && value > 100) return { ok: false, error: "A percentage goes up to 100." };
  if (countsParts(chosen) && total !== null && value > total) {
    return {
      ok: false,
      error: `It only has ${total} ${total === 1 ? UNIT_LABELS[chosen].one : UNIT_LABELS[chosen].many}, so the progress can't go past ${total}.`,
    };
  }

  return { ok: true, value: { progress: value, progress_unit: chosen } };
}

/**
 * How far along you are, from 0 to 100, for a progress bar.
 * Null when we can't know: hours, or an unknown total ("120/?").
 */
export function progressPercent(progress: number | null, unit: ProgressUnit | null, total: number | null): number | null {
  if (progress === null || unit === null) return null;
  if (unit === "percent") return Math.min(100, Math.max(0, Math.round(progress)));
  if (!countsParts(unit) || total === null || total <= 0) return null;
  // Math.floor, so 23/24 shows 95% and only 24/24 shows 100%.
  return Math.min(100, Math.floor((progress / total) * 100));
}

/**
 * The progress as text:
 *   episode 7 of 24      -> "Episode 7/24"
 *   chapter 120, unknown -> "Chapter 120/?"
 *   page 270 of 604      -> "Page 270/604 (44%)"
 *   45 percent           -> "45%"
 *   12.5 hours           -> "12.5 hours"   (1 -> "1 hour")
 * Null when there's no progress.
 */
export function formatProgress(progress: number | null, unit: ProgressUnit | null, total: number | null): string | null {
  if (progress === null || unit === null) return null;
  if (unit === "percent") return `${progress}%`;
  if (unit === "hour") return `${progress} ${progress === 1 ? "hour" : "hours"}`;

  const outOf = `${UNIT_LABELS[unit].short} ${progress}/${total ?? "?"}`;
  // Pages are big numbers, so we add the percent to make them easier to read.
  const percent = unit === "page" ? progressPercent(progress, unit, total) : null;
  return percent === null ? outOf : `${outOf} (${percent}%)`;
}

/** How much the quick "+" button adds: 1 episode or chapter, 10 pages, 5%, 1 hour. */
export function progressStep(unit: ProgressUnit): number {
  switch (unit) {
    case "page":
      return 10;
    case "percent":
      return 5;
    default:
      return 1;
  }
}

/** The label of the quick button: "+1 ep", "+1 ch", "+10 p.", "+5%", "+1 h". */
export function stepLabel(unit: ProgressUnit): string {
  const short: Record<ProgressUnit, string> = { episode: " ep", chapter: " ch", page: " p.", percent: "%", hour: " h" };
  return `+${progressStep(unit)}${short[unit]}`;
}

/**
 * The progress after pressing "+": one step more, but never past the end
 * (the total, or 100%). Null progress counts as 0.
 */
export function incrementProgress(progress: number | null, unit: ProgressUnit, total: number | null): number {
  const next = (progress ?? 0) + progressStep(unit);
  if (unit === "percent") return Math.min(100, next);
  if (countsParts(unit) && total !== null) return Math.min(total, next);
  // Hours: round to one decimal (12.5 + 1 = 13.5, without float surprises).
  return Math.round(next * 10) / 10;
}

/** True when you've reached the end: 24/24 episodes, 604/604 pages, 100%. Never for hours or unknown totals. */
export function reachedEnd(progress: number | null, unit: ProgressUnit | null, total: number | null): boolean {
  if (progress === null || unit === null) return false;
  if (unit === "percent") return progress >= 100;
  return countsParts(unit) && total !== null && total > 0 && progress >= total;
}
