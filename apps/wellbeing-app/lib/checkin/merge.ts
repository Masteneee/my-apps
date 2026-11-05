// Combining partial saves. Pure functions, tested in merge.test.ts.
//
// The check-in saves as you go: after the mood step we save { mood: 4 }, after
// the journal step { journal_text: "..." }, and so on. Each save is a "patch"
// that only contains what changed. These functions answer:
// - what does the check-in look like after applying a patch?   (applyPatch)
// - two patches waiting to be sent: what's the combined one?   (mergePatches)
// - what changed since the last save?                          (diffCheckin)

import { cleanCheckinPatch, cleanGratitude } from "./validation";
import type { Checkin, CheckinFields, CheckinPatch } from "./types";

/** A check-in with nothing answered yet. A function, so nobody can change a shared copy. */
export function emptyFields(): CheckinFields {
  return { mood: null, mood_tags: [], screen_time_minutes: null, gratitude: cleanGratitude([]), journal_text: null };
}

/** Only the answers of a check-in (or empty answers if there's none yet). */
export function fieldsOf(checkin: CheckinFields | null): CheckinFields {
  if (!checkin) return emptyFields();
  return {
    mood: checkin.mood ?? null,
    mood_tags: [...(checkin.mood_tags ?? [])],
    screen_time_minutes: checkin.screen_time_minutes ?? null,
    gratitude: cleanGratitude(checkin.gratitude),
    journal_text: checkin.journal_text ?? null,
  };
}

/**
 * Drops the keys whose value is `undefined`. Needed because { ...a, ...b }
 * would copy `mood: undefined` from b and wipe a's mood. Here undefined means
 * "not touched", and only null means "cleared".
 */
export function definedOnly(patch: CheckinPatch): CheckinPatch {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) result[key] = value;
  }
  return result as CheckinPatch;
}

/** Combines an older and a newer patch. For each field, the newer value wins. */
export function mergePatches(older: CheckinPatch | undefined, newer: CheckinPatch): CheckinPatch {
  return { ...definedOnly(older ?? {}), ...definedOnly(newer) };
}

/** What we need to build a full row when there isn't one yet. */
export type NewRowInfo = { id: string; userId: string; date: string; now: string };

/**
 * The check-in after a patch. `base` null = first save of the day, so a new
 * row is made (empty answers + the patch).
 */
export function applyPatch(base: Checkin | null, patch: CheckinPatch, info: NewRowInfo): Checkin {
  const fields = { ...fieldsOf(base), ...definedOnly(cleanCheckinPatch(patch)) };
  if (base) return { ...base, ...fields, updated_at: info.now };
  return {
    id: info.id,
    user_id: info.userId,
    date: info.date,
    ...fields,
    created_at: info.now,
    updated_at: info.now,
  };
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => item === b[index]);
  }
  return a === b;
}

/**
 * The fields of `draft` (what's on screen) that differ from `saved` (what the
 * store has). Both are cleaned first, so typing "hello " after saving "hello"
 * is NOT a change. Returns null when there's nothing to save.
 */
export function diffCheckin(saved: CheckinFields, draft: CheckinFields): CheckinPatch | null {
  const before = cleanCheckinPatch(saved);
  const after = cleanCheckinPatch(draft);
  const changes: Record<string, unknown> = {};
  for (const key of Object.keys(after) as (keyof CheckinFields)[]) {
    if (!sameValue(before[key], after[key])) changes[key] = after[key];
  }
  return Object.keys(changes).length > 0 ? (changes as CheckinPatch) : null;
}
