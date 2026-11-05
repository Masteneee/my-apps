// The REAL check-in store, used when the Supabase keys are set. Same
// `CheckinStore` contract as the demo store (./mock.ts).
//
// Row Level Security (supabase/migrations/20261105110000_checkins_habits.sql)
// makes sure each request only ever sees the sender's own rows. We still add
// `.eq("user_id", ...)` to queries: it doesn't make things safer (RLS does
// that), it just makes the query say clearly what it wants.

import type { SupabaseClient } from "@supabase/supabase-js";
import { isDateKey } from "./date";
import { fieldsOf } from "./merge";
import { OfflineError, type Checkin, type CheckinDay, type CheckinStore, type Habit, type HabitEntry } from "./types";
import { validateCheckinPatch, validateDateRange, validateEntryValue, validateNewHabit } from "./validation";

// Listing the columns (instead of "*") means a new column added later won't
// silently show up in the app.
const CHECKIN_COLUMNS =
  "id, user_id, date, mood, mood_tags, screen_time_minutes, gratitude, journal_text, created_at, updated_at";
const HABIT_COLUMNS = "id, user_id, name, icon, type, target, is_archived, created_at";
const ENTRY_COLUMNS = "habit_id, user_id, date, value";
// Stage 3: for calendars and streaks we only ever need the day and the mood.
// Asking for these two columns means your journal never travels for a calendar.
const CHECKIN_DAY_COLUMNS = "date, mood";

/**
 * Supabase sends at most 1000 rows per request (a project setting called
 * "Max rows"). A year of 5 habits is already 1825 entries, so long lists are
 * fetched in pages of this size until a page comes back with fewer rows.
 */
export const PAGE_SIZE = 1000;

type SupabaseErrorLike = { code?: string; message: string };

/** Turns database errors into sentences a person understands. */
export function friendlyCheckinError(error: SupabaseErrorLike): string {
  switch (error.code) {
    case "23505": // unique_violation: habits_unique_active_name
      return "You already have a habit with that name.";
    case "23503": // foreign_key_violation: the habit is gone or isn't yours
      return "That habit doesn't exist any more. Reload the page.";
    case "23514": // check_violation: a value is outside the allowed limits
      return "The database refused one of the values. Check its length or range.";
    case "42501": // RLS said no
      return "You can only change your own check-ins. Try logging in again.";
    default:
      return error.message || "Something went wrong. Please try again.";
  }
}

/**
 * Turns a Supabase answer into either nothing (success) or an Error to throw.
 * supabase-js doesn't throw when the network is down: it returns status 0 and
 * an error like "TypeError: Failed to fetch". We turn that into an
 * OfflineError, so the offline queue (./offline.ts) knows to keep the change.
 */
export function toStoreError(result: { error: SupabaseErrorLike | null; status?: number }): Error | null {
  if (!result.error) return null;
  if (result.status === 0) return new OfflineError();
  return new Error(friendlyCheckinError(result.error));
}

type PageResult<T> = { data: T[] | null; error: SupabaseErrorLike | null; status?: number };

/**
 * Asks for rows page by page (0-999, then 1000-1999...) and joins them.
 * `fetchPage(first, last)` asks for the rows numbered first..last (both
 * included, like Supabase's `.range()`). The query MUST be sorted, otherwise
 * the database could send the same row in two pages. Tested in supabase.test.ts.
 */
export async function fetchAllPages<T>(
  fetchPage: (first: number, last: number) => PromiseLike<PageResult<T>>,
  pageSize: number = PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  for (let first = 0; ; first += pageSize) {
    const result = await fetchPage(first, first + pageSize - 1);
    const error = toStoreError(result);
    if (error) throw error;
    const page = result.data ?? [];
    rows.push(...page);
    // A page that isn't full means there's nothing after it.
    if (page.length < pageSize) return rows;
  }
}

/** A row from the database, made safe for the app (arrays never null, 3 gratitude slots). */
export function rowToCheckin(row: Checkin): Checkin {
  return { ...row, ...fieldsOf(row) };
}

export function createSupabaseCheckinStore(supabase: SupabaseClient): CheckinStore {
  async function requireUser(): Promise<string> {
    // Reads the saved session in this browser (no network needed).
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) throw new Error("You need to be logged in to check in.");
    return userId;
  }

  function throwIfError(result: { error: SupabaseErrorLike | null; status?: number }) {
    const error = toStoreError(result);
    if (error) throw error;
  }

  return {
    mode: "supabase",

    async getCheckin(date) {
      const userId = await requireUser();
      const result = await supabase
        .from("checkins")
        .select(CHECKIN_COLUMNS)
        .eq("user_id", userId)
        .eq("date", date)
        .maybeSingle(); // zero or one row: null instead of an error when there's none
      throwIfError(result);
      return result.data ? rowToCheckin(result.data as Checkin) : null;
    },

    async saveCheckin(date, patch) {
      const userId = await requireUser();
      if (!isDateKey(date)) throw new Error("That day doesn't look right.");
      const check = validateCheckinPatch(patch);
      if (!check.ok) throw new Error(check.error);

      // An "upsert" = insert, or update if the row already exists. The
      // existing row is found by the unique (user_id, date) rule. Only the
      // columns we send are updated, so a partial save never wipes the others.
      const result = await supabase
        .from("checkins")
        .upsert(
          { user_id: userId, date, ...check.value, updated_at: new Date().toISOString() },
          { onConflict: "user_id,date" },
        )
        .select(CHECKIN_COLUMNS)
        .single();
      throwIfError(result);
      return rowToCheckin(result.data as Checkin);
    },

    async listHabits(options) {
      const userId = await requireUser();
      let query = supabase.from("habits").select(HABIT_COLUMNS).eq("user_id", userId);
      if (!options?.includeArchived) query = query.eq("is_archived", false);
      const result = await query.order("created_at", { ascending: true });
      throwIfError(result);
      return (result.data ?? []) as Habit[];
    },

    async createHabit(input) {
      const userId = await requireUser();
      const check = validateNewHabit(input);
      if (!check.ok) throw new Error(check.error);
      const { name, icon, type, target } = check.value;
      const result = await supabase
        .from("habits")
        .insert({ user_id: userId, name, icon: icon || null, type, target })
        .select(HABIT_COLUMNS)
        .single();
      throwIfError(result);
      return result.data as Habit;
    },

    async setHabitArchived(habitId, archived) {
      const userId = await requireUser();
      const result = await supabase
        .from("habits")
        .update({ is_archived: archived })
        .eq("id", habitId)
        .eq("user_id", userId)
        .select(HABIT_COLUMNS)
        .single();
      throwIfError(result);
      return result.data as Habit;
    },

    async getHabitEntries(date) {
      const userId = await requireUser();
      const result = await supabase.from("habit_entries").select(ENTRY_COLUMNS).eq("user_id", userId).eq("date", date);
      throwIfError(result);
      return (result.data ?? []) as HabitEntry[];
    },

    async saveHabitEntry(habit, date, value) {
      const userId = await requireUser();
      if (!isDateKey(date)) throw new Error("That day doesn't look right.");
      const check = validateEntryValue(habit, value);
      if (!check.ok) throw new Error(check.error);

      if (check.value === null) {
        // "Not done" = no row. Deleting a row that isn't there is fine.
        const result = await supabase
          .from("habit_entries")
          .delete()
          .eq("habit_id", habit.id)
          .eq("user_id", userId)
          .eq("date", date);
        throwIfError(result);
        return null;
      }

      const result = await supabase
        .from("habit_entries")
        .upsert(
          { habit_id: habit.id, user_id: userId, date, value: check.value, updated_at: new Date().toISOString() },
          { onConflict: "habit_id,date" },
        )
        .select(ENTRY_COLUMNS)
        .single();
      throwIfError(result);
      return result.data as HabitEntry;
    },

    // Stage 3: ranges of days. Both use the indexes from the Stage 2 migration
    // (unique (user_id, date) on checkins, habit_entries_user_date), so no new
    // migration is needed.
    async listCheckinDays(from, to) {
      const userId = await requireUser();
      const range = validateDateRange(from, to);
      if (!range.ok) throw new Error(range.error);
      return fetchAllPages<CheckinDay>((first, last) =>
        supabase
          .from("checkins")
          .select(CHECKIN_DAY_COLUMNS)
          .eq("user_id", userId)
          .gte("date", from) // gte = "greater than or equal": from this day...
          .lte("date", to) // ...lte = "less than or equal": up to this day, included
          .order("date", { ascending: true })
          .range(first, last),
      );
    },

    async listHabitEntries(from, to) {
      const userId = await requireUser();
      const range = validateDateRange(from, to);
      if (!range.ok) throw new Error(range.error);
      return fetchAllPages<HabitEntry>((first, last) =>
        supabase
          .from("habit_entries")
          .select(ENTRY_COLUMNS)
          .eq("user_id", userId)
          .gte("date", from)
          .lte("date", to)
          // Sorted by day, then habit: a fixed order, so pages never overlap.
          .order("date", { ascending: true })
          .order("habit_id", { ascending: true })
          .range(first, last),
      );
    },

    // Stage 5: whole check-ins, for "Export my data". RLS only ever returns
    // your own rows ("Owner can read their checkins"), so even a bug here
    // couldn't export someone else's journal.
    async listCheckins(from, to) {
      const userId = await requireUser();
      const range = validateDateRange(from, to);
      if (!range.ok) throw new Error(range.error);
      const rows = await fetchAllPages<Checkin>((first, last) =>
        supabase
          .from("checkins")
          .select(CHECKIN_COLUMNS)
          .eq("user_id", userId)
          .gte("date", from)
          .lte("date", to)
          .order("date", { ascending: true })
          .range(first, last),
      );
      return rows.map(rowToCheckin);
    },

    // The waiting-to-sync queue lives in ./offline.ts, which wraps this store.
    async pendingSyncCount() {
      return 0;
    },
    async syncPending() {
      return 0;
    },
  };
}
