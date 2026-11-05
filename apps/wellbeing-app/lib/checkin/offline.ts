// "Will sync when you're back online", for Supabase mode.
//
// The demo store saves to localStorage, so it never needs the internet. The
// Supabase store does. This file WRAPS the Supabase store (it takes a store
// and returns a store with the same methods, a pattern called a "decorator"):
// - saving while offline: the change is kept in localStorage, in a small
//   queue, and the app carries on as if it was saved
// - next time we're online (page load, the "online" event): the queue is sent
// - reading while offline: you see what this device knows (the queue, and the
//   habit list from last time) instead of an error
//
// What's in the queue is YOUR data (it can include journal text), so it is
// stored per account and deleted as soon as it reaches Supabase.
//
// Kept simple on purpose: if a waiting change is refused by the database (not
// a network problem), it is dropped with a console warning, so one bad change
// can't block the queue forever. Changes are checked before they are queued,
// so that should not happen.

import { isDateKey } from "./date";
import { applyPatch, mergePatches } from "./merge";
import {
  OfflineError,
  type Checkin,
  type CheckinDay,
  type CheckinPatch,
  type CheckinStore,
  type Habit,
  type HabitEntry,
} from "./types";
import { validateCheckinPatch, validateEntryValue } from "./validation";

export const PENDING_SYNC_PREFIX = "wellbeing-app:pending-sync:";

/** Shown on the streaks page when it can't reach Supabase. */
export const RANGE_OFFLINE_MESSAGE = "You're offline. Streaks and calendars will load when you're back online.";

/** Stage 5: shown when "Export my data" can't reach Supabase. */
export const EXPORT_OFFLINE_MESSAGE =
  "You're offline. The export needs the internet so it can include all your days. Try again once you're back online.";

export type SyncStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** One habit value waiting to be sent. value null = "remove it". */
export type PendingEntry = { habit: Pick<Habit, "id" | "type">; date: string; value: number | null };

/** Everything this device keeps for one account while offline. */
export type OfflineState = {
  /** date -> the combined patch waiting for that day */
  checkins: Record<string, CheckinPatch>;
  /** "habitId|date" -> the latest value for that habit and day */
  entries: Record<string, PendingEntry>;
  /** The habit list we saw last time online (names only, no answers), or null. */
  habits: Habit[] | null;
};

const emptyState = (): OfflineState => ({ checkins: {}, entries: {}, habits: null });

/** How many changes are waiting. */
export function countPending(state: OfflineState): number {
  return Object.keys(state.checkins).length + Object.keys(state.entries).length;
}

/**
 * The day's habit entries after applying the waiting ones on top of what the
 * server sent: a waiting value replaces the server's, and a waiting null
 * removes it. Pure, tested in offline.test.ts.
 */
export function overlayEntries(
  serverEntries: HabitEntry[],
  pending: PendingEntry[],
  userId: string,
  date: string,
): HabitEntry[] {
  const forDay = pending.filter((p) => p.date === date);
  const replaced = new Set(forDay.map((p) => p.habit.id));
  const result = serverEntries.filter((e) => !replaced.has(e.habit_id));
  for (const p of forDay) {
    if (p.value !== null) result.push({ habit_id: p.habit.id, user_id: userId, date, value: p.value });
  }
  return result;
}

/**
 * Stage 3, for calendars: the check-in days from the server, plus the days
 * that only exist on this device so far (a check-in saved offline and not
 * sent yet). A waiting mood replaces the server's. Pure, tested in offline.test.ts.
 */
export function overlayCheckinDays(
  serverDays: CheckinDay[],
  pending: Record<string, CheckinPatch>,
  from: string,
  to: string,
): CheckinDay[] {
  const byDate = new Map(serverDays.map((day) => [day.date, { ...day }]));
  for (const [date, patch] of Object.entries(pending)) {
    if (date < from || date > to) continue;
    const day = byDate.get(date) ?? { date, mood: null };
    if (patch.mood !== undefined) day.mood = patch.mood; // undefined = "not touched"
    byDate.set(date, day);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Same idea as overlayEntries, for a range of days and every habit: a waiting
 * value replaces the server's for that habit and day, a waiting null removes it.
 */
export function overlayEntryRange(
  serverEntries: HabitEntry[],
  pending: PendingEntry[],
  userId: string,
  from: string,
  to: string,
): HabitEntry[] {
  const inRange = pending.filter((p) => p.date >= from && p.date <= to);
  const replaced = new Set(inRange.map((p) => `${p.habit.id}|${p.date}`));
  const result = serverEntries.filter((e) => !replaced.has(`${e.habit_id}|${e.date}`));
  for (const p of inRange) {
    if (p.value !== null) result.push({ habit_id: p.habit.id, user_id: userId, date: p.date, value: p.value });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.habit_id.localeCompare(b.habit_id));
}

export type OfflineAwareStoreOptions = {
  inner: CheckinStore;
  storage: SyncStorage;
  getCurrentUserId: () => Promise<string | null>;
  /** navigator.onLine in the browser. When false we don't even try the network. */
  isOnline?: () => boolean;
  now?: () => Date;
};

export function createOfflineAwareStore({
  inner,
  storage,
  getCurrentUserId,
  isOnline = () => true,
  now = () => new Date(),
}: OfflineAwareStoreOptions): CheckinStore {
  const keyFor = (userId: string) => PENDING_SYNC_PREFIX + userId;

  function load(userId: string): OfflineState {
    const raw = storage.getItem(keyFor(userId));
    if (!raw) return emptyState();
    try {
      const parsed = JSON.parse(raw) as Partial<OfflineState>;
      return { checkins: parsed.checkins ?? {}, entries: parsed.entries ?? {}, habits: parsed.habits ?? null };
    } catch {
      return emptyState();
    }
  }

  function save(userId: string, state: OfflineState) {
    if (countPending(state) === 0 && state.habits === null) storage.removeItem(keyFor(userId));
    else storage.setItem(keyFor(userId), JSON.stringify(state));
  }

  async function requireUser(): Promise<string> {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error("You need to be logged in to check in.");
    return userId;
  }

  // Runs a network request, unless we already know there's no connection
  // (then we fail at once instead of waiting for supabase-js's retries).
  async function online<T>(request: () => Promise<T>): Promise<T> {
    if (!isOnline()) throw new OfflineError();
    return request();
  }

  // Removes a waiting change once it has been sent, but only if it wasn't
  // replaced by a newer one in the meantime (then that one still has to go).
  function removeCheckinIfUnchanged(userId: string, date: string, sent: CheckinPatch) {
    const state = load(userId);
    if (JSON.stringify(state.checkins[date]) === JSON.stringify(sent)) {
      delete state.checkins[date];
      save(userId, state);
    }
  }

  function removeEntryIfUnchanged(userId: string, key: string, sent: PendingEntry) {
    const state = load(userId);
    if (JSON.stringify(state.entries[key]) === JSON.stringify(sent)) {
      delete state.entries[key];
      save(userId, state);
    }
  }

  // A check-in built only from what this device knows (used while offline).
  function localCheckin(userId: string, date: string, patch: CheckinPatch, base: Checkin | null): Checkin {
    return applyPatch(base, patch, { id: base?.id ?? `local-${date}`, userId, date, now: now().toISOString() });
  }

  async function syncPending(): Promise<number> {
    const userId = await getCurrentUserId();
    if (!userId) return 0;
    const state = load(userId);

    for (const [date, patch] of Object.entries(state.checkins)) {
      try {
        await online(() => inner.saveCheckin(date, patch));
      } catch (error) {
        if (error instanceof OfflineError) return countPending(load(userId)); // still offline: try later
        console.warn(`Dropped a waiting check-in change for ${date}:`, error);
      }
      removeCheckinIfUnchanged(userId, date, patch);
    }

    for (const [key, entry] of Object.entries(state.entries)) {
      try {
        await online(() => inner.saveHabitEntry(entry.habit, entry.date, entry.value));
      } catch (error) {
        if (error instanceof OfflineError) return countPending(load(userId));
        console.warn(`Dropped a waiting habit change for ${entry.date}:`, error);
      }
      removeEntryIfUnchanged(userId, key, entry);
    }
    return countPending(load(userId));
  }

  return {
    mode: inner.mode,

    async getCheckin(date) {
      const userId = await requireUser();
      await syncPending(); // send anything left from last time first
      const waiting = load(userId).checkins[date];
      try {
        const remote = await online(() => inner.getCheckin(date));
        return waiting ? localCheckin(userId, date, waiting, remote) : remote;
      } catch (error) {
        if (!(error instanceof OfflineError)) throw error;
        return waiting ? localCheckin(userId, date, waiting, null) : null;
      }
    },

    async saveCheckin(date, patch) {
      const userId = await requireUser();
      if (!isDateKey(date)) throw new Error("That day doesn't look right.");
      // Check BEFORE queueing, so only valid changes ever wait in the queue.
      const check = validateCheckinPatch(patch);
      if (!check.ok) throw new Error(check.error);

      // If an older change for this day is still waiting, send both together
      // (in the right order: newer fields win), never the new one alone.
      const waiting = load(userId).checkins[date];
      const toSend = mergePatches(waiting, check.value);
      try {
        const saved = await online(() => inner.saveCheckin(date, toSend));
        if (waiting) removeCheckinIfUnchanged(userId, date, waiting);
        return saved;
      } catch (error) {
        if (!(error instanceof OfflineError)) throw error;
        const state = load(userId);
        state.checkins[date] = mergePatches(state.checkins[date], check.value);
        save(userId, state);
        return localCheckin(userId, date, state.checkins[date], null);
      }
    },

    async listHabits(options) {
      const userId = await requireUser();
      let habits: Habit[];
      try {
        // Always fetch archived ones too, so the saved copy is complete.
        habits = await online(() => inner.listHabits({ includeArchived: true }));
        const state = load(userId);
        state.habits = habits;
        save(userId, state);
      } catch (error) {
        if (!(error instanceof OfflineError)) throw error;
        habits = load(userId).habits ?? [];
      }
      return habits.filter((h) => options?.includeArchived || !h.is_archived);
    },

    async createHabit(input) {
      try {
        return await online(() => inner.createHabit(input));
      } catch (error) {
        if (error instanceof OfflineError) throw new OfflineError("You're offline. Add habits once you're back online.");
        throw error;
      }
    },

    async setHabitArchived(habitId, archived) {
      try {
        return await online(() => inner.setHabitArchived(habitId, archived));
      } catch (error) {
        if (error instanceof OfflineError) throw new OfflineError("You're offline. Change habits once you're back online.");
        throw error;
      }
    },

    async getHabitEntries(date) {
      const userId = await requireUser();
      await syncPending();
      let serverEntries: HabitEntry[] = [];
      try {
        serverEntries = await online(() => inner.getHabitEntries(date));
      } catch (error) {
        // Offline: we only know the waiting changes (entries saved earlier
        // online will show again once the connection is back).
        if (!(error instanceof OfflineError)) throw error;
      }
      return overlayEntries(serverEntries, Object.values(load(userId).entries), userId, date);
    },

    async saveHabitEntry(habit, date, value) {
      const userId = await requireUser();
      if (!isDateKey(date)) throw new Error("That day doesn't look right.");
      const check = validateEntryValue(habit, value);
      if (!check.ok) throw new Error(check.error);

      const key = `${habit.id}|${date}`;
      const waiting = load(userId).entries[key];
      try {
        // A habit value is sent whole (not as a patch), so the newest one simply wins.
        const saved = await online(() => inner.saveHabitEntry(habit, date, check.value));
        if (waiting) removeEntryIfUnchanged(userId, key, waiting);
        return saved;
      } catch (error) {
        if (!(error instanceof OfflineError)) throw error;
        const state = load(userId);
        state.entries[key] = { habit: { id: habit.id, type: habit.type }, date, value: check.value };
        save(userId, state);
        return check.value === null ? null : { habit_id: habit.id, user_id: userId, date, value: check.value };
      }
    },

    // Stage 3: ranges, for streaks and calendars. These need the server: this
    // device only keeps the changes waiting to sync, not your whole history,
    // so offline they say so instead of showing streaks that look broken.
    async listCheckinDays(from, to) {
      const userId = await requireUser();
      await syncPending();
      try {
        const days = await online(() => inner.listCheckinDays(from, to));
        // Anything that couldn't be sent yet still shows up.
        return overlayCheckinDays(days, load(userId).checkins, from, to);
      } catch (error) {
        if (error instanceof OfflineError) throw new OfflineError(RANGE_OFFLINE_MESSAGE);
        throw error;
      }
    },

    async listHabitEntries(from, to) {
      const userId = await requireUser();
      await syncPending();
      try {
        const entries = await online(() => inner.listHabitEntries(from, to));
        return overlayEntryRange(entries, Object.values(load(userId).entries), userId, from, to);
      } catch (error) {
        if (error instanceof OfflineError) throw new OfflineError(RANGE_OFFLINE_MESSAGE);
        throw error;
      }
    },

    // Stage 5: whole check-ins, for the export. Like the ranges above it needs
    // the server (this device doesn't keep your history). Waiting changes are
    // sent first; if one still couldn't go, it's applied on top, so the file
    // has what you see in the app.
    async listCheckins(from, to) {
      const userId = await requireUser();
      await syncPending();
      try {
        const rows = await online(() => inner.listCheckins(from, to));
        const byDate = new Map(rows.map((row) => [row.date, row]));
        for (const [date, patch] of Object.entries(load(userId).checkins)) {
          if (date < from || date > to) continue;
          byDate.set(date, localCheckin(userId, date, patch, byDate.get(date) ?? null));
        }
        return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
      } catch (error) {
        if (error instanceof OfflineError) throw new OfflineError(EXPORT_OFFLINE_MESSAGE);
        throw error;
      }
    },

    async pendingSyncCount() {
      const userId = await getCurrentUserId();
      return userId ? countPending(load(userId)) : 0;
    },

    syncPending,
  };
}
