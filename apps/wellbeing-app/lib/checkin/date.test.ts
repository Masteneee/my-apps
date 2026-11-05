import { describe, expect, it } from "vitest";
import { DEFAULT_TIME_ZONE, dateKeyInTimeZone, formatDateKey, isDateKey, isValidTimeZone, todayKey } from "./date";

// All instants are written in UTC ("Z"), so the tests give the same result on
// any computer, whatever its own time zone.
const at = (iso: string) => new Date(iso);

describe("dateKeyInTimeZone (Toronto by default)", () => {
  it("uses Toronto when no time zone is given", () => {
    expect(DEFAULT_TIME_ZONE).toBe("America/Toronto");
    // 15:00 UTC = 10:00 in Toronto, same day.
    expect(dateKeyInTimeZone(at("2026-11-05T15:00:00Z"))).toBe("2026-11-05");
  });

  it("keeps a late-evening check-in on the right day (UTC is already tomorrow)", () => {
    // 03:30 UTC on Nov 6 = 10:30 pm on Nov 5 in Toronto (UTC-5 in winter).
    expect(dateKeyInTimeZone(at("2026-11-06T03:30:00Z"), "America/Toronto")).toBe("2026-11-05");
    // One minute before / after Toronto midnight.
    expect(dateKeyInTimeZone(at("2026-11-06T04:59:00Z"), "America/Toronto")).toBe("2026-11-05");
    expect(dateKeyInTimeZone(at("2026-11-06T05:00:00Z"), "America/Toronto")).toBe("2026-11-06");
  });

  it("handles summer time (UTC-4) and the change back to winter time", () => {
    // July: midnight in Toronto is 04:00 UTC.
    expect(dateKeyInTimeZone(at("2026-07-15T03:59:00Z"), "America/Toronto")).toBe("2026-07-14");
    expect(dateKeyInTimeZone(at("2026-07-15T04:00:00Z"), "America/Toronto")).toBe("2026-07-15");
    // Nov 1 2026: clocks go back at 2 am, so 1:30 am happens twice. Both are Nov 1.
    expect(dateKeyInTimeZone(at("2026-11-01T05:30:00Z"), "America/Toronto")).toBe("2026-11-01");
    expect(dateKeyInTimeZone(at("2026-11-01T06:30:00Z"), "America/Toronto")).toBe("2026-11-01");
  });

  it("handles the spring change (2 am to 3 am, Mar 8 2026)", () => {
    expect(dateKeyInTimeZone(at("2026-03-08T04:59:00Z"), "America/Toronto")).toBe("2026-03-07");
    expect(dateKeyInTimeZone(at("2026-03-08T05:00:00Z"), "America/Toronto")).toBe("2026-03-08");
    expect(dateKeyInTimeZone(at("2026-03-08T07:30:00Z"), "America/Toronto")).toBe("2026-03-08");
  });

  it("uses the browser's zone when it's another one", () => {
    const instant = at("2026-11-05T20:00:00Z");
    expect(dateKeyInTimeZone(instant, "America/Toronto")).toBe("2026-11-05");
    expect(dateKeyInTimeZone(instant, "Asia/Tokyo")).toBe("2026-11-06"); // 5 am next day
    expect(dateKeyInTimeZone(instant, "UTC")).toBe("2026-11-05");
  });

  it("falls back to Toronto for an unknown time zone instead of crashing", () => {
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(dateKeyInTimeZone(at("2026-11-06T03:30:00Z"), "Mars/Olympus")).toBe("2026-11-05");
  });

  it("always writes 2-digit months and days", () => {
    expect(dateKeyInTimeZone(at("2026-01-02T17:00:00Z"), "America/Toronto")).toBe("2026-01-02");
  });
});

describe("todayKey", () => {
  it("is the date key of 'now' in the given zone", () => {
    expect(todayKey(at("2026-11-06T03:30:00Z"), "America/Toronto")).toBe("2026-11-05");
  });

  it("returns a valid key with no arguments (the real clock and the computer's zone)", () => {
    expect(isDateKey(todayKey())).toBe(true);
  });
});

describe("isDateKey", () => {
  it("accepts real dates written YYYY-MM-DD", () => {
    expect(isDateKey("2026-11-05")).toBe(true);
    expect(isDateKey("2028-02-29")).toBe(true); // leap year
  });

  it("refuses other formats and days that don't exist", () => {
    expect(isDateKey("2026-11-5")).toBe(false);
    expect(isDateKey("11/05/2026")).toBe(false);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("2026-02-29")).toBe(false); // not a leap year
    expect(isDateKey("2026-13-01")).toBe(false);
    expect(isDateKey("")).toBe(false);
  });
});

describe("formatDateKey", () => {
  it("writes the day for people, without shifting it", () => {
    expect(formatDateKey("2026-11-05")).toBe("Thursday, November 5");
    expect(formatDateKey("2026-01-01")).toBe("Thursday, January 1");
  });

  it("leaves something that isn't a date key as it is", () => {
    expect(formatDateKey("soon")).toBe("soon");
  });
});
