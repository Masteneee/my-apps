// The DEMO check-in store: keeps habits, check-ins and habit entries in the
// browser's localStorage. Used when no Supabase keys are set. It follows the
// same `CheckinStore` contract as the real one (./supabase.ts).
//
// Because localStorage is on the device, demo mode works fully OFFLINE: the
// service worker serves the page, and this store never needs the internet.
//
// It mirrors the database rules on purpose, so demo mode behaves like the real
// thing: you must be signed in, you only ever see YOUR rows (like RLS), one
// check-in per day, no two active habits with the same name.
//
// Saved under its own key, separate from the demo accounts (wellbeing-app:mock-db).

import type { KeyValueStorage } from "../auth/mock";
import { isDateKey } from "./date";
import { applyPatch, fieldsOf } from "./merge";
import type { Checkin, CheckinDay, CheckinStore, Habit, HabitEntry } from "./types";
import { validateCheckinPatch, validateDateRange, validateEntryValue, validateNewHabit } from "./validation";

export const MOCK_CHECKIN_STORAGE_KEY = "wellbeing-app:mock-checkins";

export type MockCheckinDatabase = {
  habits: Habit[];
  checkins: Checkin[];
  habitEntries: HabitEntry[];
};

const emptyDatabase = (): MockCheckinDatabase => ({ habits: [], checkins: [], habitEntries: [] });

export type MockCheckinStoreOptions = {
  storage: KeyValueStorage;
  /** Who is signed in (the demo auth knows). null = signed out. */
  getCurrentUserId: () => Promise<string | null>;
  /** How new ids are made. Tests pass a predictable one. */
  makeId?: () => string;
  /** The current time. Tests pass a fixed one. */
  now?: () => Date;
};

export function createMockCheckinStore({
  storage,
  getCurrentUserId,
  makeId = () => crypto.randomUUID(),
  now = () => new Date(),
}: MockCheckinStoreOptions): CheckinStore {
  function load(): MockCheckinDatabase {
    const raw = storage.getItem(MOCK_CHECKIN_STORAGE_KEY);
    if (!raw) return emptyDatabase();
    try {
      const parsed = JSON.parse(raw) as Partial<MockCheckinDatabase>;
      // `?? []` in case a hand-edited save is missing a part.
      return { habits: parsed.habits ?? [], checkins: parsed.checkins ?? [], habitEntries: parsed.habitEntries ?? [] };
    } catch {
      // Broken data: start over instead of crashing the check-in.
      return emptyDatabase();
    }
  }

  function save(db: MockCheckinDatabase) {
    storage.setItem(MOCK_CHECKIN_STORAGE_KEY, JSON.stringify(db));
  }

  // Like RLS: every function first asks "who is this?" and only touches their rows.
  async function requireUser(): Promise<string> {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error("You need to be logged in to check in.");
    return userId;
  }

  function requireDate(date: string) {
    if (!isDateKey(date)) throw new Error("That day doesn't look right.");
  }

  function requireRange(from: string, to: string) {
    const check = validateDateRange(from, to);
    if (!check.ok) throw new Error(check.error);
    return check.value;
  }

  function sameName(a: string, b: string) {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }

  return {
    mode: "mock",

    async getCheckin(date) {
      const userId = await requireUser();
      return load().checkins.find((c) => c.user_id === userId && c.date === date) ?? null;
    },

    async saveCheckin(date, patch) {
      const userId = await requireUser();
      requireDate(date);
      const check = validateCheckinPatch(patch);
      if (!check.ok) throw new Error(check.error);

      const db = load();
      // Like the database's "unique (user_id, date)": find today's row, or make one.
      const index = db.checkins.findIndex((c) => c.user_id === userId && c.date === date);
      const existing = index === -1 ? null : db.checkins[index];
      const saved = applyPatch(existing, check.value, { id: makeId(), userId, date, now: now().toISOString() });
      if (index === -1) db.checkins.push(saved);
      else db.checkins[index] = saved;
      save(db);
      return saved;
    },

    async listHabits(options) {
      const userId = await requireUser();
      return load()
        .habits.filter((h) => h.user_id === userId && (options?.includeArchived || !h.is_archived))
        .sort((a, b) => a.created_at.localeCompare(b.created_at)); // oldest first
    },

    async createHabit(input) {
      const userId = await requireUser();
      const check = validateNewHabit(input);
      if (!check.ok) throw new Error(check.error);

      const db = load();
      if (db.habits.some((h) => h.user_id === userId && !h.is_archived && sameName(h.name, check.value.name))) {
        throw new Error("You already have a habit with that name.");
      }
      const habit: Habit = {
        id: makeId(),
        user_id: userId,
        name: check.value.name,
        icon: check.value.icon || null,
        type: check.value.type,
        target: check.value.target,
        is_archived: false,
        created_at: now().toISOString(),
      };
      db.habits.push(habit);
      save(db);
      return habit;
    },

    async setHabitArchived(habitId, archived) {
      const userId = await requireUser();
      const db = load();
      const habit = db.habits.find((h) => h.id === habitId && h.user_id === userId);
      if (!habit) throw new Error("That habit doesn't exist.");
      // Restoring could create two active habits with the same name: refuse, like the database.
      if (
        !archived &&
        db.habits.some((h) => h.id !== habitId && h.user_id === userId && !h.is_archived && sameName(h.name, habit.name))
      ) {
        throw new Error("You already have a habit with that name.");
      }
      habit.is_archived = archived;
      save(db);
      return { ...habit };
    },

    async getHabitEntries(date) {
      const userId = await requireUser();
      return load().habitEntries.filter((e) => e.user_id === userId && e.date === date);
    },

    async saveHabitEntry(habit, date, value) {
      const userId = await requireUser();
      requireDate(date);
      const db = load();
      // Like the composite foreign key: only YOUR habits can get entries.
      const owned = db.habits.find((h) => h.id === habit.id && h.user_id === userId);
      if (!owned) throw new Error("That habit doesn't exist.");
      const check = validateEntryValue(owned, value);
      if (!check.ok) throw new Error(check.error);

      // Remove the old value for that habit and day (if any), then add the new one.
      db.habitEntries = db.habitEntries.filter((e) => !(e.habit_id === habit.id && e.date === date));
      const entry: HabitEntry | null =
        check.value === null ? null : { habit_id: habit.id, user_id: userId, date, value: check.value };
      if (entry) db.habitEntries.push(entry);
      save(db);
      return entry;
    },

    // Stage 3: ranges of days (streaks and calendars).
    async listCheckinDays(from, to) {
      const userId = await requireUser();
      const range = requireRange(from, to);
      return load()
        .checkins.filter((c) => c.user_id === userId && c.date >= range.from && c.date <= range.to)
        .map((c): CheckinDay => ({ date: c.date, mood: c.mood })) // only what the calendar needs
        .sort((a, b) => a.date.localeCompare(b.date));
    },

    async listHabitEntries(from, to) {
      const userId = await requireUser();
      const range = requireRange(from, to);
      return load()
        .habitEntries.filter((e) => e.user_id === userId && e.date >= range.from && e.date <= range.to)
        .sort((a, b) => a.date.localeCompare(b.date) || a.habit_id.localeCompare(b.habit_id));
    },

    // Stage 5: whole check-ins, for "Export my data". Still only YOUR rows.
    async listCheckins(from, to) {
      const userId = await requireUser();
      const range = requireRange(from, to);
      return load()
        .checkins.filter((c) => c.user_id === userId && c.date >= range.from && c.date <= range.to)
        .map((c) => ({ ...c, ...fieldsOf(c) })) // fresh copies, repaired like a database row (3 gratitude slots)
        .sort((a, b) => a.date.localeCompare(b.date));
    },

    // localStorage is always there, so nothing ever waits to sync in demo mode.
    async pendingSyncCount() {
      return 0;
    },
    async syncPending() {
      return 0;
    },
  };
}
