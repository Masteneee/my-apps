// Cleaning and checking what people type in the check-in and the habit form.
// Pure functions (tested in validation.test.ts).
//
// Two kinds of function here:
// - "clean": tidy up the value, never fails (trim spaces, "" becomes null...)
// - "validate": clean, then check the limits. Returns ok + the clean value, or
//   a message we can show as-is.
//
// KEEP IN SYNC with the check constraints in
// supabase/migrations/20261105110000_checkins_habits.sql (a test compares them).

import { HABIT_TYPES, type CheckinPatch, type Habit, type HabitType, type NewHabit } from "./types";

export const MOOD_MIN = 1;
export const MOOD_MAX = 5;
export const MOOD_TAGS_MAX = 5;
export const MOOD_TAG_MAX_LENGTH = 24;
export const SCREEN_TIME_MAX = 1440; // minutes in a day
export const GRATITUDE_COUNT = 3;
export const GRATITUDE_MAX = 200;
export const JOURNAL_MAX = 2000;
export const HABIT_NAME_MAX = 40;
export const HABIT_ICON_MAX = 8; // counted in "code points", like Postgres char_length
export const HABIT_NUMBER_MAX = 100000;
export const HABIT_MINUTES_MAX = 1440;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Always exactly 3 slots, trimmed: ["a", "", ""]. Extra lines are dropped. */
export function cleanGratitude(list: readonly string[] | null | undefined): string[] {
  const slots = (list ?? []).slice(0, GRATITUDE_COUNT).map((line) => (line ?? "").trim());
  while (slots.length < GRATITUDE_COUNT) slots.push("");
  return slots;
}

/** Lowercase, trimmed, no empties, no duplicates, in the order picked. */
export function cleanMoodTags(tags: readonly string[] | null | undefined): string[] {
  const clean = (tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  return [...new Set(clean)];
}

/** Trims the ends; an empty journal is stored as null ("nothing written"). */
export function cleanJournal(text: string | null | undefined): string | null {
  const trimmed = (text ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Tidies a partial save. Fields that are missing stay missing (that's what
 * makes it partial: "don't touch"). Never fails; see validateCheckinPatch.
 */
export function cleanCheckinPatch(patch: CheckinPatch): CheckinPatch {
  const clean: CheckinPatch = {};
  if (patch.mood !== undefined) clean.mood = patch.mood;
  if (patch.mood_tags !== undefined) clean.mood_tags = cleanMoodTags(patch.mood_tags);
  if (patch.screen_time_minutes !== undefined) {
    // Round: the database column is a whole number of minutes.
    clean.screen_time_minutes = patch.screen_time_minutes === null ? null : Math.round(patch.screen_time_minutes);
  }
  if (patch.gratitude !== undefined) clean.gratitude = cleanGratitude(patch.gratitude);
  if (patch.journal_text !== undefined) clean.journal_text = cleanJournal(patch.journal_text);
  return clean;
}

/** Cleans a partial save, then checks every limit. */
export function validateCheckinPatch(patch: CheckinPatch): Result<CheckinPatch> {
  const clean = cleanCheckinPatch(patch);

  if (clean.mood !== undefined && clean.mood !== null) {
    if (!Number.isInteger(clean.mood) || clean.mood < MOOD_MIN || clean.mood > MOOD_MAX) {
      return { ok: false, error: `Mood must be a whole number from ${MOOD_MIN} to ${MOOD_MAX}.` };
    }
  }
  if (clean.mood_tags) {
    if (clean.mood_tags.length > MOOD_TAGS_MAX) {
      return { ok: false, error: `Pick at most ${MOOD_TAGS_MAX} words for your mood.` };
    }
    if (clean.mood_tags.some((tag) => tag.length > MOOD_TAG_MAX_LENGTH)) {
      return { ok: false, error: `Mood words can be at most ${MOOD_TAG_MAX_LENGTH} characters.` };
    }
  }
  if (clean.screen_time_minutes !== undefined && clean.screen_time_minutes !== null) {
    const minutes = clean.screen_time_minutes;
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > SCREEN_TIME_MAX) {
      return { ok: false, error: "Screen time must be between 0 minutes and 24 hours." };
    }
  }
  if (clean.gratitude && clean.gratitude.some((line) => line.length > GRATITUDE_MAX)) {
    return { ok: false, error: `Each gratitude can be at most ${GRATITUDE_MAX} characters.` };
  }
  if (clean.journal_text && clean.journal_text.length > JOURNAL_MAX) {
    return { ok: false, error: `Your journal can be at most ${JOURNAL_MAX} characters today.` };
  }
  return { ok: true, value: clean };
}

/** The highest value a habit of this type can have in one day. */
export function habitValueMax(type: HabitType): number {
  if (type === "checkbox") return 1;
  return type === "minutes" ? HABIT_MINUTES_MAX : HABIT_NUMBER_MAX;
}

/** Checks the "new habit" form and returns a clean version of it. */
export function validateNewHabit(input: NewHabit): Result<Required<NewHabit>> {
  const name = input.name.trim().replace(/\s+/g, " "); // "  Drink   water " -> "Drink water"
  if (name.length === 0) return { ok: false, error: "Give your habit a name." };
  if (name.length > HABIT_NAME_MAX) {
    return { ok: false, error: `Habit names can be at most ${HABIT_NAME_MAX} characters.` };
  }
  if (!HABIT_TYPES.includes(input.type)) return { ok: false, error: "Pick a habit type." };

  const icon = (input.icon ?? "").trim();
  // Array.from counts "code points", so most emoji count as 1 (like Postgres does).
  if (Array.from(icon).length > HABIT_ICON_MAX) return { ok: false, error: "The icon should be one emoji." };

  let target: number | null = input.target ?? null;
  if (input.type === "checkbox") target = null; // a checkbox has no amount to aim for
  if (target !== null) {
    const max = habitValueMax(input.type);
    if (!Number.isInteger(target) || target < 1 || target > max) {
      return { ok: false, error: `The daily goal must be a whole number from 1 to ${max}.` };
    }
  }
  return { ok: true, value: { name, icon, type: input.type, target } };
}

/**
 * Checks one habit value for a day. Returns the number to save, or null for
 * "remove it" (unticked checkbox, or 0 of something: no row = not done).
 */
export function validateEntryValue(habit: Pick<Habit, "type">, value: number | null): Result<number | null> {
  if (value === null || value === 0) return { ok: true, value: null };
  if (habit.type === "checkbox") return { ok: true, value: 1 }; // any "yes" counts as done
  const max = habitValueMax(habit.type);
  if (!Number.isInteger(value) || value < 0 || value > max) {
    return { ok: false, error: `Use a whole number from 0 to ${max}.` };
  }
  return { ok: true, value };
}
