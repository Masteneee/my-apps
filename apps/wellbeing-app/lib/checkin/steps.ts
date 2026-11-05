// The steps of the check-in flow and small helpers the screens use.
// Pure, tested in steps.test.ts. The screens themselves are in components/checkin/.

import { SCREEN_TIME_MAX } from "./validation";
import type { CheckinFields } from "./types";

/** In order: mood → screen time → 3 gratitudes → short journal → habits. */
export const STEPS = [
  { id: "mood", title: "How do you feel?" },
  { id: "screen", title: "Screen time today" },
  { id: "gratitude", title: "Three good things" },
  { id: "journal", title: "A few lines about today" },
  { id: "habits", title: "Your habits" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

/** The 5 moods. The number is what's saved; emoji + word are what you see. */
export const MOODS = [
  { value: 1, emoji: "😞", label: "Awful" },
  { value: 2, emoji: "😕", label: "Low" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
] as const;

/** Optional words to describe the mood (tap to pick, up to 5). */
export const MOOD_TAGS = [
  "calm",
  "happy",
  "energetic",
  "grateful",
  "focused",
  "tired",
  "stressed",
  "anxious",
  "sad",
  "lonely",
] as const;

export function moodFor(value: number | null) {
  return MOODS.find((mood) => mood.value === value) ?? null;
}

/** Has this step been answered? (Used for the progress dots and the summary.) */
export function isStepAnswered(step: StepId, fields: CheckinFields, habitsDone: number): boolean {
  switch (step) {
    case "mood":
      return fields.mood !== null;
    case "screen":
      return fields.screen_time_minutes !== null;
    case "gratitude":
      return fields.gratitude.some((line) => line.trim() !== "");
    case "journal":
      return (fields.journal_text ?? "").trim() !== "";
    case "habits":
      return habitsDone > 0;
  }
}

/** How many of the 5 steps have an answer. */
export function answeredCount(fields: CheckinFields, habitsDone: number): number {
  return STEPS.filter((step) => isStepAnswered(step.id, fields, habitsDone)).length;
}

/** 135 -> "2 h 15 min", 60 -> "1 h", 45 -> "45 min", null -> "Not set". */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "Not set";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Adds (or removes, with a negative delta) minutes, staying between 0 and 24 h. null counts as 0. */
export function addMinutes(minutes: number | null, delta: number, max = SCREEN_TIME_MAX): number {
  return Math.min(max, Math.max(0, (minutes ?? 0) + delta));
}
