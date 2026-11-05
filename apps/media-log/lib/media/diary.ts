// The diary (Stage 4): every log as a timeline, grouped by month, newest first.
// Pure functions, tested in diary.test.ts. The page is components/DiaryView.tsx.

import type { LogWithMedia } from "./types";
import { localToday } from "./validation";

/**
 * The day a log belongs to in the diary, "YYYY-MM-DD":
 * the day you finished it if you gave one ("Watched on"), otherwise the day you logged it.
 *
 * `created_at` is stored in UTC ("2026-11-05T02:30:00Z"). localToday() turns it
 * into YOUR calendar day, so something logged at 9:30 pm in Montreal on Nov 4
 * shows on Nov 4, not Nov 5.
 */
export function diaryDate(log: Pick<LogWithMedia, "finished_at" | "created_at">): string {
  return log.finished_at ?? localToday(new Date(log.created_at));
}

// Written out by hand (instead of the browser's Intl date tools) so the result
// is the same on every computer, whatever its language. That keeps tests simple.
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-11" -> "November 2026". */
export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** "2026-11-04" -> "Nov 4, 2026" (shorter and friendlier than the raw date). */
export function formatShortDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${MONTH_NAMES[month - 1].slice(0, 3)} ${day}, ${year}`;
}

export type DiaryEntry = {
  log: LogWithMedia;
  date: string; // "YYYY-MM-DD", from diaryDate()
  day: number; // 5 for "2026-11-05", shown big on the left like a calendar
};

export type DiaryMonth = {
  key: string; // "2026-11"
  label: string; // "November 2026"
  entries: DiaryEntry[];
};

/**
 * Groups logs by month, newest month first, and newest day first inside a month.
 * Two logs on the same day: the one logged most recently comes first.
 * Every log is an entry, so a rewatch shows up again on its own date.
 */
export function groupDiaryByMonth(logs: LogWithMedia[]): DiaryMonth[] {
  const entries: DiaryEntry[] = logs.map((log) => {
    const date = diaryDate(log);
    return { log, date, day: Number(date.slice(8, 10)) };
  });

  // "YYYY-MM-DD" and ISO times sort correctly as plain text, so localeCompare works.
  // b before a = newest first.
  entries.sort((a, b) => b.date.localeCompare(a.date) || b.log.created_at.localeCompare(a.log.created_at));

  const months: DiaryMonth[] = [];
  for (const entry of entries) {
    const key = entry.date.slice(0, 7); // "2026-11-05" -> "2026-11"
    // Entries are sorted, so a new month always starts after the last one.
    const last = months[months.length - 1];
    if (last && last.key === key) {
      last.entries.push(entry);
    } else {
      months.push({ key, label: monthLabel(key), entries: [entry] });
    }
  }
  return months;
}
