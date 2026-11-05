// STREAKS: how many days in a row you did something. Pure functions (no
// database, no clock, no browser), tested in streaks.test.ts.
//
// Everything works on DATE KEYS ("2026-11-05"), never on timestamps. The key
// was already worked out in your time zone when you checked in
// (lib/checkin/date.ts), so 11:58 pm in Toronto belongs to that day even
// though UTC says it's tomorrow. From then on we only count calendar days,
// with addDays/daysBetween, which can't be fooled by daylight saving time.
//
// THE RULES (also in README.md and LEARNING.md):
// 1. A streak = the number of DONE days in a row.
// 2. Today not done yet doesn't break anything: you still have until
//    midnight. The streak only breaks once a whole day is missed.
// 3. A FREEZE saves a streak when you miss ONE day: if you did it the day
//    before and the day after, the missed day in between is "frozen". The
//    streak keeps going, but the frozen day doesn't add to the count.
// 4. You get ONE freeze per 7 days: after a freeze on day F, the next one can
//    be used on day F + 7 at the earliest. Two missed days in a row always
//    break the streak (a freeze only ever covers a single day).
// 5. Freezes are automatic. Nothing is stored for them: they are worked out
//    again from your history every time, so there's nothing to get out of sync.
//
// Example (D = done, . = missed):   D D . D D D . D
//   day 3 is frozen (a freeze was ready). Day 7 is also a single missed day,
//   but only 4 days after the first freeze, so it breaks the streak.
//   Best = 5 (days 1, 2, 4, 5, 6), current = 1 (day 8).

import { addDays, daysBetween, isDateKey } from "./checkin/date";
import type { Habit, HabitEntry } from "./checkin/types";

/**
 * Where the streak screens start reading your history. Any day before this
 * app existed works: it just means "everything". (The store fetches long
 * histories in pages, see fetchAllPages in lib/checkin/supabase.ts.)
 */
export const HISTORY_START = "2020-01-01";

/** Rule 4: after a freeze, this many days must pass before the next one. */
export const FREEZE_EVERY_DAYS = 7;

/**
 * - "done-today": today is done, the streak is safe until tomorrow
 * - "pending":    today isn't done yet, but the streak is alive (do it before midnight)
 * - "at-risk":    yesterday was missed; doing it today lets a freeze cover yesterday
 * - "none":       no streak right now
 */
export type StreakStatus = "done-today" | "pending" | "at-risk" | "none";

export type Streak = {
  /** Done days in the streak that is still alive (0 if none). */
  current: number;
  /** The longest streak ever, in done days. */
  best: number;
  status: StreakStatus;
  /** Days a freeze covered, oldest first. */
  frozenDays: string[];
  /** Days that weren't done (from your first done day to yesterday), not counting frozen ones. */
  missedDays: string[];
  /** The first day a freeze can be used again (today = one is ready now). */
  freezeReadyOn: string;
  /** The most recent done day, or null. */
  lastDoneDate: string | null;
};

/** Can a freeze be used on `day`, given the day of the last freeze? (Rule 4) */
export function freezeReady(lastFreeze: string | null, day: string): boolean {
  return lastFreeze === null || daysBetween(lastFreeze, day) >= FREEZE_EVERY_DAYS;
}

/**
 * Works out a streak from the days something was done.
 * `doneDates`: date keys, in any order, duplicates allowed.
 * `today`: today's date key in YOUR time zone (todayKey() in the app; a fixed
 * value in tests). Days after today are ignored (a phone with a wrong clock
 * could have saved them).
 */
export function computeStreak(doneDates: Iterable<string>, today: string): Streak {
  // A Set answers "was this day done?" instantly and removes duplicates.
  // YYYY-MM-DD keys sort like dates, so `<=` on strings compares days.
  const done = new Set([...doneDates].filter((key) => isDateKey(key) && key <= today));

  if (done.size === 0) {
    return { current: 0, best: 0, status: "none", frozenDays: [], missedDays: [], freezeReadyOn: today, lastDoneDate: null };
  }

  const sorted = [...done].sort();
  const firstDone = sorted[0];
  const lastDoneDate = sorted[sorted.length - 1];

  let run = 0; // done days in the streak we're walking through
  let best = 0;
  let lastFreeze: string | null = null;
  let atRisk = false;
  const frozenDays: string[] = [];
  const missedDays: string[] = [];

  // Walk every PAST day, oldest first, from the first done day to yesterday.
  for (let day = firstDone; day < today; day = addDays(day, 1)) {
    if (done.has(day)) {
      run += 1;
      best = Math.max(best, run);
      continue;
    }

    // A missed day. Rule 3: a freeze needs a done day before it (run > 0)
    // and a done day after it. Rule 4: and a freeze must be ready.
    const nextDay = addDays(day, 1);
    const canFreeze = run > 0 && freezeReady(lastFreeze, day);

    if (canFreeze && done.has(nextDay)) {
      frozenDays.push(day);
      lastFreeze = day;
      continue; // the streak survives, `run` stays the same
    }

    missedDays.push(day);

    if (canFreeze && nextDay === today) {
      // Missed YESTERDAY, and today isn't done yet. Rule 2: today isn't over,
      // so don't break the streak yet. If you do it today, the next time this
      // runs, yesterday becomes a frozen day.
      atRisk = true;
      continue;
    }

    run = 0; // the streak is broken
  }

  const doneToday = done.has(today);
  if (doneToday) {
    run += 1;
    best = Math.max(best, run);
  }

  let status: StreakStatus = "none";
  if (doneToday) status = "done-today";
  else if (run > 0) status = atRisk ? "at-risk" : "pending";

  // When can the next freeze be used? If yesterday is waiting for one
  // ("at-risk"), count from yesterday.
  const freezeDay = atRisk ? addDays(today, -1) : lastFreeze;
  const freezeReadyOn = freezeReady(freezeDay, today) ? today : addDays(freezeDay as string, FREEZE_EVERY_DAYS);

  return { current: run, best, status, frozenDays, missedDays, freezeReadyOn, lastDoneDate };
}

// ---------------------------------------------------------------------------
// What counts as "done"?
// ---------------------------------------------------------------------------

/**
 * Is this habit done with this value?
 * - yes/no habits: any entry (value 1) = done
 * - count / minutes habits WITH a daily goal: done when the goal is reached
 *   (5 glasses of water out of 8 is a good start, but not done)
 * - count / minutes habits without a goal: any amount = done
 */
export function isHabitDone(habit: Pick<Habit, "type" | "target">, value: number | null | undefined): boolean {
  if (value === null || value === undefined || value <= 0) return false;
  if (habit.type === "checkbox" || habit.target === null) return true;
  return value >= habit.target;
}

/** The days this habit was done, from all your habit entries (other habits' entries are ignored). */
export function habitDoneDates(habit: Pick<Habit, "id" | "type" | "target">, entries: HabitEntry[]): string[] {
  return entries.filter((e) => e.habit_id === habit.id && isHabitDone(habit, e.value)).map((e) => e.date);
}

/**
 * The days you checked in, for the check-in streak: a day counts if you saved
 * anything that day, either an answer (there's a check-in row) or a habit.
 */
export function checkinDoneDates(checkinDays: { date: string }[], entries: HabitEntry[]): string[] {
  return [...checkinDays.map((d) => d.date), ...entries.map((e) => e.date)];
}

// ---------------------------------------------------------------------------
// Everything the streak screens need, in one go
// ---------------------------------------------------------------------------

export type HabitStreak = { habit: Habit; streak: Streak };
export type StreakSummary = { checkin: Streak; habits: HabitStreak[] };

/** The check-in streak plus one streak per habit, in the habits' order. */
export function summarizeStreaks(
  habits: Habit[],
  checkinDays: { date: string }[],
  entries: HabitEntry[],
  today: string,
): StreakSummary {
  return {
    checkin: computeStreak(checkinDoneDates(checkinDays, entries), today),
    habits: habits.map((habit) => ({ habit, streak: computeStreak(habitDoneDates(habit, entries), today) })),
  };
}

/** What to do next, in a few words: "Done today.", "Not done yet today."... */
export function streakHint(streak: Streak): string {
  switch (streak.status) {
    case "done-today":
      return "Done today.";
    case "pending":
      return "Not done yet today.";
    case "at-risk":
      return "You missed yesterday: do it today and a freeze saves your streak.";
    case "none":
      return streak.best > 0 ? "No streak right now. Today is a good day to start again." : "No streak yet.";
  }
}
