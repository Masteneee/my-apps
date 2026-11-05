// The shapes of check-in and habit data, and the "contract" (interface) every
// check-in store must follow. Same idea as lib/auth/types.ts: pages only talk
// to `CheckinStore`, so the demo store (localStorage) and the Supabase store
// can be swapped without the pages knowing.

export type HabitType = "checkbox" | "number" | "minutes";
export const HABIT_TYPES: HabitType[] = ["checkbox", "number", "minutes"];

/** One row of the `habits` table (supabase/migrations/20261105110000_checkins_habits.sql). */
export type Habit = {
  id: string;
  user_id: string;
  name: string;
  icon: string | null; // an optional emoji
  type: HabitType;
  target: number | null; // daily goal for number/minutes habits, null for checkbox
  is_archived: boolean;
  created_at: string;
};

export type NewHabit = {
  name: string;
  icon?: string;
  type: HabitType;
  target?: number | null;
};

/**
 * The answers of one check-in. Every one can be empty, because every step is
 * skippable: null = "not answered", [] or "" slots = nothing written.
 */
export type CheckinFields = {
  mood: number | null; // 1 (awful) to 5 (great)
  mood_tags: string[];
  screen_time_minutes: number | null;
  gratitude: string[]; // always 3 slots in the app ("" = empty slot)
  journal_text: string | null;
};

/**
 * A PARTIAL save: only the fields that changed. A field that is missing
 * (undefined) means "don't touch it"; null means "clear it".
 * This is what lets the app save step by step.
 */
export type CheckinPatch = Partial<CheckinFields>;

/** One row of the `checkins` table: the answers plus who, which day, and when. */
export type Checkin = CheckinFields & {
  id: string;
  user_id: string;
  date: string; // "YYYY-MM-DD", the LOCAL day (see date.ts)
  created_at: string;
  updated_at: string;
};

/** One row of `habit_entries`. No row means "not done that day". */
export type HabitEntry = {
  habit_id: string;
  user_id: string;
  date: string;
  value: number; // checkbox: 1; number/minutes: the amount
};

export type StoreMode = "supabase" | "mock";

/**
 * Thrown when a request couldn't reach the internet. The offline-aware store
 * (offline.ts) catches it and keeps the change on this device instead.
 */
export class OfflineError extends Error {
  constructor(message = "You're offline.") {
    super(message);
    this.name = "OfflineError";
  }
}

export interface CheckinStore {
  readonly mode: StoreMode;

  /** The signed-in user's check-in for that day, or null if none yet. */
  getCheckin(date: string): Promise<Checkin | null>;
  /** Saves only the fields in `patch` (creates the day's row if needed). Throws a friendly Error. */
  saveCheckin(date: string, patch: CheckinPatch): Promise<Checkin>;

  /** Your habits, oldest first. Archived ones only if asked. */
  listHabits(options?: { includeArchived?: boolean }): Promise<Habit[]>;
  createHabit(input: NewHabit): Promise<Habit>;
  setHabitArchived(habitId: string, archived: boolean): Promise<Habit>;

  getHabitEntries(date: string): Promise<HabitEntry[]>;
  /** Saves one habit's value for a day. null (or 0) removes it = "not done". */
  saveHabitEntry(habit: Pick<Habit, "id" | "type">, date: string, value: number | null): Promise<HabitEntry | null>;

  /** How many changes are saved on this device, waiting for the internet. Always 0 in demo mode. */
  pendingSyncCount(): Promise<number>;
  /** Tries to send those waiting changes now. Returns how many are still waiting. */
  syncPending(): Promise<number>;
}
