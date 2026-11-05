import { describe, expect, it } from "vitest";
import { diaryDate, formatShortDate, groupDiaryByMonth, monthLabel } from "./diary";
import type { LogWithMedia } from "./types";

// Times are at noon UTC on purpose: noon UTC is the same calendar day in every
// time zone from UTC-11 to UTC+11, so these tests pass on any computer.
function log(id: string, createdAt: string, finishedAt: string | null = null): LogWithMedia {
  return {
    id,
    user_id: "user-1",
    media_item_id: `item-${id}`,
    status: "completed",
    rating: null,
    progress: null,
    progress_unit: null,
    review_text: null,
    started_at: null,
    finished_at: finishedAt,
    rewatch: false,
    created_at: createdAt,
    media: {
      id: `item-${id}`,
      type: "movie",
      source: "tmdb",
      source_id: id,
      title: id,
      year: null,
      cover_url: null,
      creators: [],
      total_units: null,
      cached_at: createdAt,
    },
  };
}

describe("diaryDate", () => {
  it("uses the finished date when there is one", () => {
    expect(diaryDate(log("a", "2026-11-05T12:00:00.000Z", "2026-10-31"))).toBe("2026-10-31");
  });

  it("otherwise uses the day it was logged", () => {
    expect(diaryDate(log("a", "2026-11-05T12:00:00.000Z"))).toBe("2026-11-05");
  });
});

describe("monthLabel", () => {
  it("names the month in words", () => {
    expect(monthLabel("2026-11")).toBe("November 2026");
    expect(monthLabel("2025-01")).toBe("January 2025");
    expect(monthLabel("2024-12")).toBe("December 2024");
  });
});

describe("formatShortDate", () => {
  it("writes a date the short way, without a leading zero", () => {
    expect(formatShortDate("2026-11-04")).toBe("Nov 4, 2026");
    expect(formatShortDate("2025-05-31")).toBe("May 31, 2025");
  });
});

describe("groupDiaryByMonth", () => {
  it("is empty with no logs", () => {
    expect(groupDiaryByMonth([])).toEqual([]);
  });

  it("groups by month, newest month and newest day first", () => {
    const months = groupDiaryByMonth([
      log("oct-3", "2026-10-03T12:00:00.000Z"),
      log("nov-5", "2026-11-05T12:00:00.000Z"),
      log("oct-20", "2026-10-20T12:00:00.000Z"),
      log("nov-1", "2026-11-01T12:00:00.000Z"),
      log("dec-2025", "2025-12-24T12:00:00.000Z"),
    ]);

    expect(months.map((m) => m.label)).toEqual(["November 2026", "October 2026", "December 2025"]);
    expect(months.map((m) => m.entries.map((e) => e.log.id))).toEqual([["nov-5", "nov-1"], ["oct-20", "oct-3"], ["dec-2025"]]);
    expect(months[0].key).toBe("2026-11");
    expect(months[0].entries[0]).toMatchObject({ date: "2026-11-05", day: 5 });
  });

  it("files a log under the day you finished it, even if you logged it later", () => {
    // Logged in November, but you said you watched it on October 31.
    const months = groupDiaryByMonth([
      log("logged-late", "2026-11-05T12:00:00.000Z", "2026-10-31"),
      log("today", "2026-11-04T12:00:00.000Z"),
    ]);
    expect(months.map((m) => [m.key, m.entries.map((e) => e.log.id)])).toEqual([
      ["2026-11", ["today"]],
      ["2026-10", ["logged-late"]],
    ]);
  });

  it("puts the most recently logged first when two are on the same day", () => {
    const months = groupDiaryByMonth([
      log("morning", "2026-11-05T10:00:00.000Z"),
      log("afternoon", "2026-11-05T14:00:00.000Z"),
    ]);
    expect(months[0].entries.map((e) => e.log.id)).toEqual(["afternoon", "morning"]);
  });

  it("keeps every log, so a rewatch is its own entry", () => {
    const first = log("first", "2026-09-01T12:00:00.000Z");
    const rewatch = { ...log("rewatch", "2026-11-02T12:00:00.000Z"), media_item_id: first.media_item_id, rewatch: true };
    const months = groupDiaryByMonth([rewatch, first]);
    expect(months.flatMap((m) => m.entries).map((e) => e.log.id)).toEqual(["rewatch", "first"]);
  });
});
