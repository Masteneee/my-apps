// Pure checks for what the "log this" form sends. Both stores (demo and
// Supabase) call validateLogInput(), so the rules live in one place.
// The database checks the same things again (see the logs table in the migration).

import { LOG_STATUSES, type LogStatus, type MediaItem, type MediaResult, type NewLogInput } from "./types";

export const RATING_MIN = 0.5;
export const RATING_MAX = 5;
export const RATING_STEP = 0.5;
export const REVIEW_MAX = 5000; // KEEP IN SYNC with logs.review_text in the migration

/** 0.5, 1, 1.5, ... 5: every rating the form offers. */
export const RATING_OPTIONS: number[] = Array.from({ length: RATING_MAX / RATING_STEP }, (_, i) => (i + 1) * RATING_STEP);

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * A rating is optional (null = "not rated"). If given, it must be between 0.5
 * and 5, in half steps: 3.5 is fine, 3.3 and 0 are not.
 */
export function validateRating(value: unknown): Result<number | null> {
  if (value === null || value === undefined) return { ok: true, value: null };
  // typeof NaN is "number", so we also check Number.isFinite.
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, error: "The rating must be a number." };
  }
  if (value < RATING_MIN || value > RATING_MAX) {
    return { ok: false, error: `The rating must be between ${RATING_MIN} and ${RATING_MAX} stars.` };
  }
  // "A multiple of 0.5" = "times 2 gives a whole number". Multiplying by 2 is
  // exact for halves, so we avoid rounding surprises like 0.1 + 0.2 !== 0.3.
  if (!Number.isInteger(value * 2)) {
    return { ok: false, error: "The rating must be in half stars (like 3 or 3.5)." };
  }
  return { ok: true, value };
}

export function isLogStatus(value: unknown): value is LogStatus {
  return typeof value === "string" && (LOG_STATUSES as readonly string[]).includes(value);
}

/**
 * Today's date as "YYYY-MM-DD" in the user's own time zone.
 * (new Date().toISOString() would give the UTC date, which is "tomorrow"
 * in the evening in Quebec.) `now` is a parameter so tests can fix the date.
 */
export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** True for a real calendar date written "YYYY-MM-DD" (so "2026-02-30" is false). */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // JavaScript quietly turns Feb 30 into Mar 2. If the parts changed, it wasn't real.
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** The cleaned log fields, ready to be saved (snake_case like the database). */
export type CleanLogFields = {
  status: LogStatus;
  rating: number | null;
  review_text: string | null;
  finished_at: string | null;
  rewatch: boolean;
};

/**
 * Checks the whole form and returns either the cleaned values or the first
 * problem as a sentence we can show the user.
 * `today` ("YYYY-MM-DD") is passed in so tests don't depend on the real date.
 */
export function validateLogInput(input: NewLogInput, today: string): Result<CleanLogFields> {
  if (!isLogStatus(input.status)) {
    return { ok: false, error: "Pick a status." };
  }

  const rating = validateRating(input.rating);
  if (!rating.ok) return rating;
  // You can't rate what you haven't seen yet.
  if (input.status === "planned" && rating.value !== null) {
    return {
      ok: false,
      error: "You can't rate something you haven't watched, read or played yet. Remove the rating or change the status.",
    };
  }

  const review = (input.reviewText ?? "").trim();
  if (review.length > REVIEW_MAX) {
    return { ok: false, error: `Your review is too long (${review.length}/${REVIEW_MAX} characters).` };
  }

  // A "finished on" date and the rewatch flag only make sense once it's finished.
  const finished = input.status === "completed";
  let finishedAt: string | null = null;
  if (finished && input.finishedAt) {
    if (!isValidDate(input.finishedAt)) {
      return { ok: false, error: "That date doesn't look right. Use the date picker." };
    }
    // "YYYY-MM-DD" strings sort like dates, so plain > works here.
    if (input.finishedAt > today) {
      return { ok: false, error: "The finished date can't be in the future." };
    }
    finishedAt = input.finishedAt;
  }

  return {
    ok: true,
    value: {
      status: input.status,
      rating: rating.value,
      review_text: review || null, // "" becomes null, like display names
      finished_at: finishedAt,
      rewatch: finished && input.rewatch === true,
    },
  };
}

/**
 * The columns of a new `media_items` row, made from a search result.
 * (The database or the demo store adds `id` and `cached_at`.)
 */
export function mediaItemFields(result: MediaResult): Omit<MediaItem, "id" | "cached_at"> {
  return {
    type: result.type,
    source: result.source,
    source_id: result.sourceId,
    title: result.title,
    year: result.year,
    cover_url: result.coverUrl,
    creators: result.creators,
    total_units: result.totalUnits,
  };
}
