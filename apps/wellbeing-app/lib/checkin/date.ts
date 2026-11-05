// "Which day is it?" for the check-in. Pure functions, tested in date.test.ts.
//
// Why is this tricky? A date like "2026-11-05" depends on WHERE you are. At
// 10 pm in Toronto it's already 3 am the next day in UTC (the time zone
// servers and `new Date().toISOString()` use). If we used the UTC day, an
// evening check-in would land on tomorrow. So we always ask: what is the date
// on the wall clock in the user's time zone?

/** Used when the browser can't tell us its time zone (very rare). */
export const DEFAULT_TIME_ZONE = "America/Toronto";

/** A "date key" looks like "2026-11-05": year-month-day, always 2-digit month and day. */
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True if `timeZone` is a real IANA time zone name like "America/Toronto". */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    // Intl throws a RangeError for unknown time zones.
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The browser's own time zone (from the phone's settings), or Toronto as a fallback. */
export function browserTimeZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone && isValidTimeZone(zone) ? zone : DEFAULT_TIME_ZONE;
}

/**
 * The local date of `instant` in `timeZone`, as "YYYY-MM-DD".
 * Example: 2026-11-06 at 03:30 UTC is still 2026-11-05 (10:30 pm) in Toronto.
 */
export function dateKeyInTimeZone(instant: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  // formatToParts gives us the pieces separately, so we don't depend on how a
  // language orders them ("11/5/2026" vs "5/11/2026").
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today's date key, in the browser's time zone (America/Toronto by default). */
export function todayKey(now: Date = new Date(), timeZone: string = browserTimeZone()): string {
  return dateKeyInTimeZone(now, timeZone);
}

/** True for a real calendar date written as "YYYY-MM-DD" (so "2026-02-30" is false). */
export function isDateKey(value: string): boolean {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // Date.UTC "rolls over" impossible dates (Feb 30 becomes Mar 2), so if the
  // numbers come back different, the date didn't exist.
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * A date key written for people: "Thursday, November 5".
 * We format it in UTC on purpose: the key is already the local day, and
 * formatting it in another zone could shift it by one day.
 */
export function formatDateKey(key: string, locale = "en-CA"): string {
  if (!isDateKey(key)) return key;
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(locale, {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Counting days between date keys (Stage 3: streaks and calendars)
// ---------------------------------------------------------------------------
//
// Why not just add 24 hours? Because in Toronto two days a year are NOT 24
// hours long: in March (clocks jump forward) a day lasts 23 h, in November
// (clocks go back) 25 h. "Now + 24 h" on the November day would land on the
// same calendar day again, and a streak would count one day twice.
//
// The trick: a date key is just a calendar date, with no time and no zone. We
// do the maths in UTC, where every day is exactly 24 h, then turn the result
// back into a key. The time zone was already used once, when the key was made
// (dateKeyInTimeZone above), and never again.

const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC midnight of a date key, in milliseconds. Only used for counting. */
function keyToUtcMs(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function utcMsToKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10); // "2026-11-05T00:00:00.000Z" -> "2026-11-05"
}

/** The date key `days` days later (or earlier, if negative). addDays("2026-02-28", 1) = "2026-03-01". */
export function addDays(key: string, days: number): string {
  return utcMsToKey(keyToUtcMs(key) + days * DAY_MS);
}

/** How many days from `from` to `to`: daysBetween("2026-11-05", "2026-11-07") = 2. Negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  // Math.round is just a safety net: both are exact UTC midnights, so the
  // difference is always a whole number of days.
  return Math.round((keyToUtcMs(to) - keyToUtcMs(from)) / DAY_MS);
}

/** Day of the week of a date key: 0 = Sunday, 1 = Monday ... 6 = Saturday. */
export function weekdayOf(key: string): number {
  return new Date(keyToUtcMs(key)).getUTCDay();
}
