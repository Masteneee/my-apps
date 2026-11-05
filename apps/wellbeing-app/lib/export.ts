// "EXPORT MY DATA" (Stage 5): builds the JSON and CSV files. Pure functions
// (no database, no browser), tested in export.test.ts. The page that asks the
// store for your data and starts the download is components/ExportCard.tsx.
//
// Two formats, for two uses:
// - JSON: everything, exactly as stored (habits, check-ins, habit entries).
//   Good for keeping a backup or moving to another app. A program can read it
//   back without guessing anything.
// - CSV: one row per day, one column per answer and per habit. Opens in
//   Excel, Numbers or Google Sheets, for making your own charts.
//
// Only YOUR data goes in: your account, your habits, your check-ins (journal
// and gratitude included, they're yours) and your habit entries. Friends and
// shared streaks are left out on purpose: they're about another person too.
// As a safety net, buildExport drops any row whose user_id isn't yours.

import type { Checkin, Habit, HabitEntry } from "./checkin/types";
import { moodFor } from "./checkin/steps";

/**
 * The days the export asks the store for: "everything". Wider than any real
 * history on purpose, so even a day saved by a phone with a wrong clock
 * (in the past or the future) is still in your file.
 */
export const EXPORT_RANGE = { from: "2000-01-01", to: "9999-12-31" } as const;

/** Bump this if the file's shape changes, so a program reading old files can tell. */
export const EXPORT_FORMAT_VERSION = 1;

export type ExportAccount = {
  id: string;
  email: string;
  username: string | null; // null if the profile couldn't load (offline the very first time)
  display_name: string | null;
};

export type DataExport = {
  app: "Wellbeing";
  format_version: number;
  /** When the file was made (an ISO timestamp, in UTC). */
  exported_at: string;
  /** The time zone the dates were written in. Every `date` is a LOCAL day in it. */
  time_zone: string;
  account: ExportAccount;
  habits: Habit[];
  checkins: Checkin[];
  habit_entries: HabitEntry[];
  /** Said in the file itself, so nobody wonders where their friends went. */
  not_included: string;
};

export type ExportInput = {
  account: ExportAccount;
  habits: Habit[];
  checkins: Checkin[];
  habitEntries: HabitEntry[];
  exportedAt: Date;
  timeZone: string;
};

export const NOT_INCLUDED_NOTE =
  "Friends and shared streaks are not included: they involve another person. Your password is never exported (the app never sees it).";

/** Puts your data together in a fixed order (habits oldest first, days oldest first). */
export function buildExport({ account, habits, checkins, habitEntries, exportedAt, timeZone }: ExportInput): DataExport {
  const mine = <T extends { user_id: string }>(rows: T[]) => rows.filter((row) => row.user_id === account.id);
  return {
    app: "Wellbeing",
    format_version: EXPORT_FORMAT_VERSION,
    exported_at: exportedAt.toISOString(),
    time_zone: timeZone,
    account,
    habits: mine(habits).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    checkins: mine(checkins).sort((a, b) => a.date.localeCompare(b.date)),
    habit_entries: mine(habitEntries).sort((a, b) => a.date.localeCompare(b.date) || a.habit_id.localeCompare(b.habit_id)),
    not_included: NOT_INCLUDED_NOTE,
  };
}

/** The JSON file: indented by 2 spaces so a person can read it too. */
export function exportToJson(data: DataExport): string {
  return JSON.stringify(data, null, 2) + "\n";
}

// ---------------------------------------------------------------------------
// CSV ("comma-separated values")
// ---------------------------------------------------------------------------
//
// A CSV file is a table written as text: one line per row, commas between the
// cells. The tricky part is text that CONTAINS a comma, a quote or a new line
// (a journal easily does). The standard rule (RFC 4180): wrap that cell in
// double quotes, and write any quote inside it twice.
//   I said "hi", then left   ->   "I said ""hi"", then left"

/** One cell, quoted only if it needs to be. null/undefined = empty cell. */
export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One line of the table. */
export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvField).join(",");
}

/**
 * A column title for each habit. Two habits can share a name (an archived
 * "Read" and a new "Read"), and a table can't have two identical columns, so
 * the later ones get " (2)", " (3)"...
 */
export function habitColumnNames(habits: Pick<Habit, "name" | "is_archived">[]): string[] {
  const seen = new Map<string, number>();
  return habits.map((habit) => {
    const base = habit.is_archived ? `${habit.name} (archived)` : habit.name;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

/** What a habit's cell says: "yes" for a yes/no habit, the amount for the others. */
function habitCell(habit: Habit, value: number | undefined): string | number | null {
  if (value === undefined) return null; // no entry = not done that day = empty cell
  return habit.type === "checkbox" ? "yes" : value;
}

export const CSV_BASE_COLUMNS = [
  "date",
  "mood",
  "mood_word",
  "mood_tags",
  "screen_time_minutes",
  "gratitude_1",
  "gratitude_2",
  "gratitude_3",
  "journal",
];

/**
 * The CSV file: one row per day that has a check-in or a habit entry, oldest
 * first, then one column per habit.
 *
 * Two details that make it open nicely in Excel:
 * - it starts with a "BOM" (﻿), an invisible character that tells Excel
 *   the file is UTF-8, so "café" and emoji don't turn into "cafÃ©";
 * - lines end with \r\n, as the CSV standard says.
 */
export function exportToCsv(data: DataExport): string {
  const habits = data.habits;
  const header = [...CSV_BASE_COLUMNS, ...habitColumnNames(habits)];

  const checkinByDate = new Map(data.checkins.map((c) => [c.date, c]));
  // "habitId|date" -> value: finds one habit's value for one day instantly.
  const valueOf = new Map(data.habit_entries.map((e) => [`${e.habit_id}|${e.date}`, e.value]));
  const dates = [...new Set([...data.checkins.map((c) => c.date), ...data.habit_entries.map((e) => e.date)])].sort();

  const rows = dates.map((date) => {
    const c = checkinByDate.get(date);
    const gratitude = c?.gratitude ?? [];
    return csvRow([
      date,
      c?.mood ?? null,
      moodFor(c?.mood ?? null)?.label ?? null,
      (c?.mood_tags ?? []).join("; "), // several words in one cell, without commas
      c?.screen_time_minutes ?? null,
      gratitude[0] || null,
      gratitude[1] || null,
      gratitude[2] || null,
      c?.journal_text || null,
      ...habits.map((habit) => habitCell(habit, valueOf.get(`${habit.id}|${date}`))),
    ]);
  });

  return "﻿" + [csvRow(header), ...rows].join("\r\n") + "\r\n";
}

/** "wellbeing-export-2026-11-05.json" */
export function exportFileName(today: string, extension: "json" | "csv"): string {
  return `wellbeing-export-${today}.${extension}`;
}
