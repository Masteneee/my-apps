// INSIGHTS (Stage 5): the weekly summary. Pure functions (no database, no
// clock, no browser), tested in insights.test.ts.
//
// Two questions, answered with plain averages you could check by hand:
// 1. MOOD TREND: what was my average mood each week, and is this week higher
//    or lower than last week?
// 2. HABITS AND MOOD: on days I did a habit, was my mood different from days
//    I didn't? For each habit: the average mood on "done" days, the average on
//    "not done" days, and how many days are behind each number.
//
// HONESTY RULES (also shown in the app):
// - Only days where you picked a mood count. A day with no mood isn't "a bad
//   day", it's a day we know nothing about, so it's left out.
// - No number is shown until there are at least MIN_DAYS_EACH_SIDE days on
//   EACH side (done and not done). Two good days prove nothing.
// - Small differences (under SAME_BAND, on a 1 to 5 scale) are called "about
//   the same": with this few days, a 0.1 gap is just noise.
// - This is CORRELATION, NOT CAUSE. Maybe stretching lifts your mood. Maybe
//   you only stretch on days you already feel good. Maybe both happen on
//   weekends. The numbers can't tell these apart, and the app says so.
//
// WEEKS use date keys ("2026-11-05"), the LOCAL day in your time zone
// (America/Toronto by default), like streaks. A week runs Monday to Sunday,
// like the calendar heatmap (startOfWeek in lib/calendar.ts).

import { startOfWeek } from "./calendar";
import { addDays, dateKeyInTimeZone, DEFAULT_TIME_ZONE, isDateKey } from "./checkin/date";
import type { CheckinDay, Habit, HabitEntry } from "./checkin/types";
import { isHabitDone } from "./streaks";

/** How many weeks the mood trend shows (this week and the 7 before it). */
export const TREND_WEEKS = 8;
/** The habit comparison looks at this week and the 3 before it. */
export const INSIGHT_WEEKS = 4;
/** A habit needs at least this many mood days done AND this many not done. */
export const MIN_DAYS_EACH_SIDE = 4;
/** A week needs at least this many mood days before we compare it with another. */
export const MIN_TREND_DAYS = 3;
/** Differences smaller than this (on the 1 to 5 mood scale) count as "about the same". */
export const SAME_BAND = 0.3;

/** The average of some numbers, or null for an empty list (there IS no average of nothing). */
export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/** date -> mood, for the days that have a mood (1 to 5) and aren't after today. */
function moodByDate(days: CheckinDay[], today: string): Map<string, number> {
  const moods = new Map<string, number>();
  for (const day of days) {
    if (!isDateKey(day.date) || day.date > today) continue; // a phone with a wrong clock could save "tomorrow"
    if (day.mood === null || day.mood < 1 || day.mood > 5) continue;
    moods.set(day.date, day.mood);
  }
  return moods;
}

// ---------------------------------------------------------------------------
// 1. Mood, week by week
// ---------------------------------------------------------------------------

export type WeekMood = {
  /** The Monday of the week. */
  weekStart: string;
  /** The Sunday, or today for the week we're in. */
  weekEnd: string;
  /** How many days of that week have a mood. */
  moodDays: number;
  /** Their average, or null if none. */
  average: number | null;
  /** True for the week that contains today (it isn't over yet). */
  isCurrent: boolean;
};

/** The average mood of each of the last `weeks` weeks, oldest first. The last one is this week (so far). */
export function weeklyMoods(days: CheckinDay[], today: string, weeks: number = TREND_WEEKS): WeekMood[] {
  const moods = moodByDate(days, today);
  const thisMonday = startOfWeek(today);
  const result: WeekMood[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDays(thisMonday, -7 * i);
    const isCurrent = i === 0;
    const weekEnd = isCurrent ? today : addDays(weekStart, 6);
    const values: number[] = [];
    // YYYY-MM-DD keys sort like dates, so `<=` on strings compares days.
    for (let day = weekStart; day <= weekEnd; day = addDays(day, 1)) {
      const mood = moods.get(day);
      if (mood !== undefined) values.push(mood);
    }
    result.push({ weekStart, weekEnd, moodDays: values.length, average: average(values), isCurrent });
  }
  return result;
}

/**
 * - "up" / "down": this week's average is at least SAME_BAND higher / lower than last week's
 * - "steady":      the difference is smaller than that
 * - "not-enough":  one of the two weeks has fewer than MIN_TREND_DAYS mood days
 */
export type TrendDirection = "up" | "down" | "steady" | "not-enough";

export type MoodTrend = {
  direction: TrendDirection;
  /** This week's average minus last week's, or null when we can't compare. */
  change: number | null;
  thisWeek: WeekMood;
  lastWeek: WeekMood;
};

/** Compares the last two weeks of `weeks` (as made by weeklyMoods, so at least 2 of them). */
export function moodTrend(weeks: WeekMood[], minDays: number = MIN_TREND_DAYS): MoodTrend {
  if (weeks.length < 2) throw new Error("moodTrend needs at least two weeks.");
  const thisWeek = weeks[weeks.length - 1];
  const lastWeek = weeks[weeks.length - 2];

  if (thisWeek.average === null || lastWeek.average === null || thisWeek.moodDays < minDays || lastWeek.moodDays < minDays) {
    return { direction: "not-enough", change: null, thisWeek, lastWeek };
  }
  const change = thisWeek.average - lastWeek.average;
  const direction: TrendDirection = Math.abs(change) < SAME_BAND ? "steady" : change > 0 ? "up" : "down";
  return { direction, change, thisWeek, lastWeek };
}

// ---------------------------------------------------------------------------
// 2. Habits and mood
// ---------------------------------------------------------------------------

/**
 * The days the habit comparison looks at: from the Monday INSIGHT_WEEKS - 1
 * weeks before this one, to YESTERDAY. Today is left out on purpose: the day
 * isn't over, and most people pick a mood before ticking their habits, so
 * today would wrongly look like a "not done" day.
 */
export function insightWindow(today: string, weeks: number = INSIGHT_WEEKS): { from: string; to: string } {
  return { from: addDays(startOfWeek(today), -7 * (weeks - 1)), to: addDays(today, -1) };
}

/**
 * - "better":     mood is at least SAME_BAND higher on days you did it
 * - "lower":      mood is at least SAME_BAND lower on days you did it
 * - "same":       the difference is smaller than that
 * - "not-enough": fewer than MIN_DAYS_EACH_SIDE days on one side (nothing is shown)
 */
export type HabitMoodVerdict = "better" | "lower" | "same" | "not-enough";

export type HabitMoodInsight = {
  habit: Habit;
  /** Mood days (in the window) when the habit was done / not done. */
  doneDays: number;
  notDoneDays: number;
  /** Average mood on those days (null if there are none). */
  doneAverage: number | null;
  notDoneAverage: number | null;
  /** doneAverage - notDoneAverage, or null when there isn't enough data. */
  difference: number | null;
  verdict: HabitMoodVerdict;
};

export type HabitMoodOptions = {
  /** First and last day to look at (both included), e.g. from insightWindow(). */
  from: string;
  to: string;
  /** Your time zone, to turn the habit's creation time into a local day. */
  timeZone?: string;
  minDays?: number;
};

/**
 * The first day a habit could have been done: the day it was created (in your
 * time zone), or its first entry if that's earlier (an entry typed in for a
 * past day). Days before that don't count as "not done": the habit didn't exist.
 */
export function habitStartDate(habit: Pick<Habit, "id" | "created_at">, entries: HabitEntry[], timeZone: string): string | null {
  const created = new Date(habit.created_at);
  let start = Number.isNaN(created.getTime()) ? null : dateKeyInTimeZone(created, timeZone);
  for (const entry of entries) {
    if (entry.habit_id === habit.id && isDateKey(entry.date) && (start === null || entry.date < start)) start = entry.date;
  }
  return start;
}

/** For one habit: mood on done days vs not-done days. */
export function habitMoodInsight(
  habit: Habit,
  moods: Map<string, number>,
  entries: HabitEntry[],
  { from, to, timeZone = DEFAULT_TIME_ZONE, minDays = MIN_DAYS_EACH_SIDE }: HabitMoodOptions,
): HabitMoodInsight {
  // The days this habit was done (a habit with a daily goal needs the goal, like streaks).
  const doneDates = new Set(
    entries.filter((e) => e.habit_id === habit.id && isHabitDone(habit, e.value)).map((e) => e.date),
  );
  const start = habitStartDate(habit, entries, timeZone);
  const first = start !== null && start > from ? start : from;

  const done: number[] = [];
  const notDone: number[] = [];
  for (const [date, mood] of moods) {
    if (date < first || date > to) continue;
    if (doneDates.has(date)) done.push(mood);
    else notDone.push(mood);
  }

  const doneAverage = average(done);
  const notDoneAverage = average(notDone);
  const enough = done.length >= minDays && notDone.length >= minDays;
  const difference = enough && doneAverage !== null && notDoneAverage !== null ? doneAverage - notDoneAverage : null;

  let verdict: HabitMoodVerdict = "not-enough";
  if (difference !== null) verdict = Math.abs(difference) < SAME_BAND ? "same" : difference > 0 ? "better" : "lower";

  return { habit, doneDays: done.length, notDoneDays: notDone.length, doneAverage, notDoneAverage, difference, verdict };
}

/**
 * Every habit's insight. Habits with enough data come first, biggest
 * "better mood" difference first; then the ones that need more days, in the
 * habits' own order.
 */
export function habitMoodInsights(
  habits: Habit[],
  checkinDays: CheckinDay[],
  entries: HabitEntry[],
  options: HabitMoodOptions,
): HabitMoodInsight[] {
  const moods = moodByDate(checkinDays, options.to);
  const insights = habits.map((habit) => habitMoodInsight(habit, moods, entries, options));
  const withData = insights
    .filter((i) => i.difference !== null)
    // [...].sort: a copy, so the original order stays for the others.
    .sort((a, b) => (b.difference as number) - (a.difference as number));
  const needMore = insights.filter((i) => i.difference === null);
  return [...withData, ...needMore];
}

// ---------------------------------------------------------------------------
// Everything the insights page needs, in one go
// ---------------------------------------------------------------------------

export type WeeklySummary = {
  today: string;
  weeks: WeekMood[];
  trend: MoodTrend;
  /** The days the habit comparison used. */
  window: { from: string; to: string };
  habits: HabitMoodInsight[];
  /** This week so far: how many days you checked in, and each habit's done days. */
  thisWeek: { checkinDays: number; habitDays: { habit: Habit; days: number }[] };
};

export type SummaryInput = {
  habits: Habit[];
  checkinDays: CheckinDay[];
  entries: HabitEntry[];
  today: string;
  timeZone?: string;
};

export function buildWeeklySummary({ habits, checkinDays, entries, today, timeZone = DEFAULT_TIME_ZONE }: SummaryInput): WeeklySummary {
  const weeks = weeklyMoods(checkinDays, today);
  const window = insightWindow(today);
  const monday = startOfWeek(today);
  const inThisWeek = (date: string) => date >= monday && date <= today;

  // A day counts as "checked in" if you saved anything (same rule as the check-in streak).
  const checkedIn = new Set([...checkinDays.map((d) => d.date), ...entries.map((e) => e.date)].filter(inThisWeek));
  const habitDays = habits.map((habit) => ({
    habit,
    days: new Set(
      entries.filter((e) => e.habit_id === habit.id && inThisWeek(e.date) && isHabitDone(habit, e.value)).map((e) => e.date),
    ).size,
  }));

  return {
    today,
    weeks,
    trend: moodTrend(weeks),
    window,
    habits: habitMoodInsights(habits, checkinDays, entries, { ...window, timeZone }),
    thisWeek: { checkinDays: checkedIn.size, habitDays },
  };
}

// ---------------------------------------------------------------------------
// Words for the screen
// ---------------------------------------------------------------------------

/** 3.8333 -> "3.8", null -> "–". One decimal: more would pretend to be precise. */
export function formatMood(value: number | null): string {
  return value === null ? "–" : value.toFixed(1);
}

/** "1 day" / "4 days" */
export function dayCount(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

/** One sentence for the trend. */
export function trendSentence(trend: MoodTrend): string {
  const { thisWeek, lastWeek } = trend;
  switch (trend.direction) {
    case "not-enough":
      return `Not enough days to compare yet: each week needs a mood on at least ${MIN_TREND_DAYS} days (this week ${thisWeek.moodDays}, last week ${lastWeek.moodDays}).`;
    case "steady":
      return `About the same as last week (${formatMood(thisWeek.average)} vs ${formatMood(lastWeek.average)}).`;
    case "up":
      return `Higher than last week (${formatMood(thisWeek.average)} vs ${formatMood(lastWeek.average)}).`;
    case "down":
      return `Lower than last week (${formatMood(thisWeek.average)} vs ${formatMood(lastWeek.average)}). Weeks go up and down; be kind to yourself.`;
  }
}

/** One sentence for a habit. */
export function habitSentence(insight: HabitMoodInsight): string {
  const name = insight.habit.name;
  switch (insight.verdict) {
    case "not-enough":
      return `Not enough days yet. Needs at least ${MIN_DAYS_EACH_SIDE} days with a mood when you did ${name} and ${MIN_DAYS_EACH_SIDE} when you didn't (now ${insight.doneDays} and ${insight.notDoneDays}).`;
    case "same":
      return `Your mood was about the same on days you did ${name} and days you didn't.`;
    case "better":
      return `Your mood was higher on days you did ${name}.`;
    case "lower":
      return `Your mood was lower on days you did ${name}.`;
  }
}
