// The CALENDAR HEATMAP: a grid of little squares, one per day, coloured by how
// the day went (your mood, or how much of a habit you did). Pure functions,
// tested in calendar.test.ts. The drawing is in components/CalendarHeatmap.tsx.
//
// Layout: one ROW per week (Monday to Sunday by default), the most recent week
// at the bottom, like a paper calendar. That fits a phone screen better than
// GitHub's long horizontal strip.
//
// Like streaks.ts, everything is date keys ("2026-11-05"), never timestamps.

import { addDays, weekdayOf } from "./checkin/date";
import type { CheckinDay, Habit, HabitEntry } from "./checkin/types";
import { isHabitDone } from "./streaks";

// Written out instead of asking Intl, so the labels (and the tests) are the
// same on every computer, whatever its language settings.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** How many weeks the calendar shows by default (about 3 months). */
export const DEFAULT_WEEKS = 12;

export type CalendarCell = {
  date: string;
  /** 1 to 31, written in the square. */
  dayOfMonth: number;
  /** How strong the colour is (mood: 1-5, habit: 1-4), or null = nothing that day. */
  level: number | null;
  /** A streak freeze covered this day (shown with a snowflake). */
  frozen: boolean;
  /** After today: drawn empty, never "missed". */
  future: boolean;
  isToday: boolean;
};

export type CalendarWeek = {
  /** The first day of the week, also a handy React key. */
  start: string;
  /** "Nov" on the first row and on each row where a month starts, else null. */
  monthLabel: string | null;
  days: CalendarCell[]; // always 7
};

export type CalendarGrid = {
  /** Column titles, in order: ["Mon", "Tue", ...]. */
  weekdayLabels: string[];
  weeks: CalendarWeek[];
};

export type CalendarOptions = {
  today: string;
  /** How many weeks (rows) to show, the current week included. */
  weeks?: number;
  /** 0 = weeks start on Sunday, 1 = Monday (default). */
  weekStartsOn?: 0 | 1;
  /** date key -> level. Days that aren't in here have no colour. */
  levels: Record<string, number>;
  /** Days a streak freeze covered. */
  frozen?: Iterable<string>;
};

/** "Nov 5" for a date key. */
export function shortDate(key: string): string {
  const [, month, day] = key.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}`;
}

/** The first day of the week that contains `key`. */
export function startOfWeek(key: string, weekStartsOn: 0 | 1 = 1): string {
  // How many days since the week started: for a Monday start, Sunday (0) is 6 days in.
  const daysIn = (weekdayOf(key) - weekStartsOn + 7) % 7;
  return addDays(key, -daysIn);
}

/** Builds the grid: `weeks` rows of 7 days, the last row being the week of `today`. */
export function buildCalendarGrid({
  today,
  weeks = DEFAULT_WEEKS,
  weekStartsOn = 1,
  levels,
  frozen = [],
}: CalendarOptions): CalendarGrid {
  const frozenSet = new Set(frozen);
  const lastWeekStart = startOfWeek(today, weekStartsOn);
  const firstWeekStart = addDays(lastWeekStart, -7 * (Math.max(1, weeks) - 1));

  const rows: CalendarWeek[] = [];
  for (let start = firstWeekStart; start <= lastWeekStart; start = addDays(start, 7)) {
    const days: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      const future = date > today;
      days.push({
        date,
        dayOfMonth: Number(date.slice(8, 10)),
        level: future ? null : (levels[date] ?? null),
        frozen: !future && frozenSet.has(date),
        future,
        isToday: date === today,
      });
    }
    // Label the first row, and every row that contains the 1st of a month.
    const firstOfMonth = days.find((d) => d.dayOfMonth === 1);
    const labelDay = rows.length === 0 ? days[0] : firstOfMonth;
    rows.push({ start, monthLabel: labelDay ? MONTHS[Number(labelDay.date.slice(5, 7)) - 1] : null, days });
  }

  const weekdayLabels = Array.from({ length: 7 }, (_, i) => WEEKDAYS[(weekStartsOn + i) % 7]);
  return { weekdayLabels, weeks: rows };
}

// ---------------------------------------------------------------------------
// Levels: how strong each day's colour is
// ---------------------------------------------------------------------------

/** Mood calendar: the level is the mood itself (1 = awful ... 5 = great). Days with no mood stay empty. */
export function moodLevels(days: CheckinDay[]): Record<string, number> {
  const levels: Record<string, number> = {};
  for (const day of days) {
    if (day.mood !== null) levels[day.date] = day.mood;
  }
  return levels;
}

/** The highest habit level: "done" (goal reached). */
export const HABIT_DONE_LEVEL = 4;

/**
 * Habit calendar, levels 1 to 4:
 * - 4 = done (yes/no ticked, or the daily goal reached)
 * - 1 to 3 = some progress towards the goal (a third, two thirds, almost)
 * Days with no entry stay empty.
 */
export function habitLevel(habit: Pick<Habit, "type" | "target">, value: number): number | null {
  if (value <= 0) return null;
  if (isHabitDone(habit, value)) return HABIT_DONE_LEVEL;
  // Only count/minutes habits with a goal get here (value < target).
  const share = value / (habit.target as number); // 0 to just under 1
  return 1 + Math.floor(share * 3); // 0-0.33 -> 1, 0.33-0.66 -> 2, 0.66-1 -> 3
}

export function habitLevels(habit: Pick<Habit, "id" | "type" | "target">, entries: HabitEntry[]): Record<string, number> {
  const levels: Record<string, number> = {};
  for (const entry of entries) {
    if (entry.habit_id !== habit.id) continue;
    const level = habitLevel(habit, entry.value);
    if (level !== null) levels[entry.date] = level;
  }
  return levels;
}
