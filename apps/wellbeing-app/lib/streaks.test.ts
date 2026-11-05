import { describe, expect, it } from "vitest";
import { addDays, dateKeyInTimeZone, todayKey } from "./checkin/date";
import type { Habit, HabitEntry } from "./checkin/types";
import {
  checkinDoneDates,
  computeStreak,
  FREEZE_EVERY_DAYS,
  freezeReady,
  habitDoneDates,
  isHabitDone,
  streakHint,
  summarizeStreaks,
} from "./streaks";

// Test helper: writes a history as a little picture, one letter per day,
// starting on `start`. "D" = done, "." = missed. The LAST letter is today,
// unless `today` is given.
//   history("2026-11-01", "DD.D") -> done on Nov 1, 2 and 4, today = Nov 4
function history(start: string, picture: string) {
  const done: string[] = [];
  [...picture].forEach((letter, i) => {
    if (letter === "D") done.push(addDays(start, i));
  });
  return { done, today: addDays(start, picture.length - 1) };
}

function streakOf(picture: string, start = "2026-11-01") {
  const { done, today } = history(start, picture);
  return computeStreak(done, today);
}

describe("computeStreak: the basics", () => {
  it("has no streak when nothing was ever done", () => {
    expect(computeStreak([], "2026-11-05")).toEqual({
      current: 0,
      best: 0,
      status: "none",
      frozenDays: [],
      missedDays: [],
      freezeReadyOn: "2026-11-05",
      lastDoneDate: null,
    });
  });

  it("counts done days in a row, ending today", () => {
    const streak = streakOf("DDD");
    expect(streak.current).toBe(3);
    expect(streak.best).toBe(3);
    expect(streak.status).toBe("done-today");
    expect(streak.lastDoneDate).toBe("2026-11-03");
  });

  it("only today done = a streak of 1", () => {
    expect(computeStreak(["2026-11-05"], "2026-11-05")).toMatchObject({ current: 1, best: 1, status: "done-today" });
  });

  it("does not break the streak when TODAY isn't done yet", () => {
    // Done Nov 1-3, today is Nov 4 and not done (yet).
    const streak = streakOf("DDD.");
    expect(streak.current).toBe(3);
    expect(streak.status).toBe("pending");
    expect(streak.missedDays).toEqual([]); // today isn't over, so it isn't missed
  });

  it("remembers the best streak after a break", () => {
    // 4 in a row, two missed days (breaks it), then 2 in a row.
    const streak = streakOf("DDDD..DD");
    expect(streak.best).toBe(4);
    expect(streak.current).toBe(2);
  });

  it("works whatever the order, and ignores duplicates", () => {
    const streak = computeStreak(["2026-11-03", "2026-11-01", "2026-11-02", "2026-11-02"], "2026-11-03");
    expect(streak.current).toBe(3);
  });

  it("ignores days after today (a wrong clock) and things that aren't date keys", () => {
    const streak = computeStreak(["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-31", "soon"], "2026-11-05");
    expect(streak.current).toBe(2);
    expect(streak.lastDoneDate).toBe("2026-11-05");
  });

  it("lists the missed days, from the first done day to yesterday", () => {
    expect(streakOf("D..D.").missedDays).toEqual(["2026-11-02", "2026-11-03"]);
  });

  it("goes across months and years", () => {
    expect(computeStreak(["2026-12-30", "2026-12-31", "2027-01-01"], "2027-01-01").current).toBe(3);
    expect(computeStreak(["2028-02-28", "2028-02-29", "2028-03-01"], "2028-03-01").current).toBe(3); // leap day
  });
});

describe("computeStreak: missed days and the freeze", () => {
  it("a single missed day between two done days is frozen: the streak goes on", () => {
    const streak = streakOf("DD.DD");
    expect(streak.frozenDays).toEqual(["2026-11-03"]);
    expect(streak.missedDays).toEqual([]);
    // The frozen day keeps the streak alive but doesn't count: 4 done days.
    expect(streak.current).toBe(4);
    expect(streak.status).toBe("done-today");
  });

  it("two missed days in a row always break the streak (a freeze covers one day)", () => {
    const streak = streakOf("DD..D");
    expect(streak.frozenDays).toEqual([]);
    expect(streak.missedDays).toEqual(["2026-11-03", "2026-11-04"]);
    expect(streak.current).toBe(1);
    expect(streak.best).toBe(2);
  });

  it("only one freeze per 7 days: a second miss 4 days later breaks the streak", () => {
    // The example at the top of streaks.ts.
    const streak = streakOf("DD.DDD.D");
    expect(streak.frozenDays).toEqual(["2026-11-03"]);
    expect(streak.missedDays).toEqual(["2026-11-07"]);
    expect(streak.best).toBe(5);
    expect(streak.current).toBe(1);
  });

  it("a freeze is ready again exactly 7 days after the last one", () => {
    expect(FREEZE_EVERY_DAYS).toBe(7);
    // Misses on Nov 3 and Nov 10: 7 days apart, so both are frozen.
    const streak = streakOf("DD.DDDDDD.DD");
    expect(streak.frozenDays).toEqual(["2026-11-03", "2026-11-10"]);
    expect(streak.current).toBe(10);
    // 6 days apart (Nov 3 and Nov 9) is one day too soon.
    expect(streakOf("DD.DDDDD.DD").frozenDays).toEqual(["2026-11-03"]);
  });

  it("freezeReady: none used yet, or 7+ days since the last one", () => {
    expect(freezeReady(null, "2026-11-05")).toBe(true);
    expect(freezeReady("2026-11-01", "2026-11-07")).toBe(false); // 6 days
    expect(freezeReady("2026-11-01", "2026-11-08")).toBe(true); // 7 days
  });

  it("missed YESTERDAY and today not done yet: 'at risk', the streak isn't broken yet", () => {
    const streak = streakOf("DDD..", "2026-11-01"); // Nov 4 missed, today Nov 5 not done
    expect(streak.status).toBe("at-risk");
    expect(streak.current).toBe(3);
    // The freeze is "booked" for yesterday, so the next one is a week after it.
    expect(streak.freezeReadyOn).toBe("2026-11-11");

    // ...then you do it today: yesterday becomes a frozen day.
    const after = streakOf("DDD.D", "2026-11-01");
    expect(after.status).toBe("done-today");
    expect(after.frozenDays).toEqual(["2026-11-04"]);
    expect(after.current).toBe(4);
  });

  it("missed yesterday with no freeze ready: the streak is over", () => {
    // Freeze used on Nov 3; Nov 6 is missed only 3 days later; today is Nov 7.
    const streak = streakOf("DD.DD..");
    expect(streak.status).toBe("none");
    expect(streak.current).toBe(0);
    expect(streak.best).toBe(4);
  });

  it("a freeze needs a done day BEFORE the missed day too", () => {
    // Broken by 2 missed days, then one done day, then one miss, then done:
    // the single miss has a done day on each side, so it's frozen.
    expect(streakOf("D..D.D").frozenDays).toEqual(["2026-11-05"]);
    // Days before your first done day are never "missed".
    expect(computeStreak(["2026-11-05"], "2026-11-05").missedDays).toEqual([]);
  });

  it("says when the next freeze is ready", () => {
    expect(streakOf("DDD").freezeReadyOn).toBe("2026-11-03"); // none used: ready today
    expect(streakOf("DD.DD").freezeReadyOn).toBe("2026-11-10"); // used Nov 3
  });
});

describe("computeStreak: time zones and daylight saving (America/Toronto)", () => {
  it("counts every day across the spring change (Mar 8 2026 is only 23 hours long)", () => {
    const streak = computeStreak(["2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10"], "2026-03-10");
    expect(streak.current).toBe(5);
    expect(streak.missedDays).toEqual([]);
  });

  it("counts every day across the fall change (Nov 1 2026 is 25 hours long)", () => {
    const streak = computeStreak(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"], "2026-11-02");
    expect(streak.current).toBe(4);
    // And a missed day ON the change day is still exactly one day: frozen.
    expect(computeStreak(["2026-10-31", "2026-11-02"], "2026-11-02").frozenDays).toEqual(["2026-11-01"]);
  });

  it("late-night check-ins stay on their own Toronto day (UTC is already tomorrow)", () => {
    // 11:58 pm Toronto on Nov 4, Nov 5 and Nov 6 (04:58 UTC the next day).
    const instants = ["2026-11-05T04:58:00Z", "2026-11-06T04:58:00Z", "2026-11-07T04:58:00Z"];
    const keys = instants.map((iso) => dateKeyInTimeZone(new Date(iso), "America/Toronto"));
    expect(keys).toEqual(["2026-11-04", "2026-11-05", "2026-11-06"]);

    // "Now" is 11:30 pm Toronto on Nov 6 = 04:30 UTC on Nov 7.
    const today = todayKey(new Date("2026-11-07T04:30:00Z"), "America/Toronto");
    expect(today).toBe("2026-11-06");
    expect(computeStreak(keys, today)).toMatchObject({ current: 3, status: "done-today" });

    // If we had wrongly used the UTC day, "today" would be Nov 7 and the
    // streak would look "not done yet" at 11:30 pm.
    expect(computeStreak(keys, "2026-11-07").status).toBe("pending");
  });

  it("11:59 pm and 12:01 am are two different days (one check-in each = 2 days)", () => {
    const beforeMidnight = dateKeyInTimeZone(new Date("2026-11-06T04:59:00Z"), "America/Toronto"); // Nov 5, 11:59 pm
    const afterMidnight = dateKeyInTimeZone(new Date("2026-11-06T05:01:00Z"), "America/Toronto"); // Nov 6, 12:01 am
    expect(computeStreak([beforeMidnight, afterMidnight], afterMidnight).current).toBe(2);
  });

  it("late-night check-ins on the night the clocks go back still make a streak", () => {
    // Oct 31 11:30 pm (EDT, UTC-4) and Nov 1 11:30 pm (EST, UTC-5).
    const a = dateKeyInTimeZone(new Date("2026-11-01T03:30:00Z"), "America/Toronto");
    const b = dateKeyInTimeZone(new Date("2026-11-02T04:30:00Z"), "America/Toronto");
    expect([a, b]).toEqual(["2026-10-31", "2026-11-01"]);
    expect(computeStreak([a, b], b).current).toBe(2);
  });
});

// ---------------------------------------------------------------------------

const habit = (over: Partial<Habit>): Habit => ({
  id: "h1",
  user_id: "u1",
  name: "Water",
  icon: null,
  type: "checkbox",
  target: null,
  is_archived: false,
  created_at: "2026-11-01T12:00:00.000Z",
  ...over,
});
const entry = (habit_id: string, date: string, value: number): HabitEntry => ({ habit_id, user_id: "u1", date, value });

describe("isHabitDone", () => {
  it("yes/no habits: any entry is done", () => {
    expect(isHabitDone({ type: "checkbox", target: null }, 1)).toBe(true);
    expect(isHabitDone({ type: "checkbox", target: null }, null)).toBe(false);
  });

  it("count and minutes habits with a goal: done only when the goal is reached", () => {
    expect(isHabitDone({ type: "number", target: 8 }, 5)).toBe(false);
    expect(isHabitDone({ type: "number", target: 8 }, 8)).toBe(true);
    expect(isHabitDone({ type: "minutes", target: 20 }, 25)).toBe(true);
  });

  it("without a goal: any amount above 0 is done", () => {
    expect(isHabitDone({ type: "minutes", target: null }, 3)).toBe(true);
    expect(isHabitDone({ type: "minutes", target: null }, 0)).toBe(false);
    expect(isHabitDone({ type: "minutes", target: null }, undefined)).toBe(false);
  });
});

describe("habitDoneDates and checkinDoneDates", () => {
  it("keeps only this habit's days where the goal was reached", () => {
    const water = habit({ id: "w", type: "number", target: 8 });
    const entries = [entry("w", "2026-11-01", 8), entry("w", "2026-11-02", 3), entry("other", "2026-11-03", 1)];
    expect(habitDoneDates(water, entries)).toEqual(["2026-11-01"]);
  });

  it("a day counts for the check-in streak with a saved answer OR a habit", () => {
    const dates = checkinDoneDates([{ date: "2026-11-01" }], [entry("w", "2026-11-02", 1)]);
    expect(dates.sort()).toEqual(["2026-11-01", "2026-11-02"]);
  });
});

describe("summarizeStreaks", () => {
  it("gives the check-in streak and one streak per habit, in order", () => {
    const stretch = habit({ id: "s", name: "Stretch" });
    const read = habit({ id: "r", name: "Read", type: "minutes", target: 20 });
    const entries = [
      entry("s", "2026-11-04", 1),
      entry("s", "2026-11-05", 1),
      entry("r", "2026-11-05", 10), // not enough minutes
    ];
    const summary = summarizeStreaks([stretch, read], [{ date: "2026-11-03" }], entries, "2026-11-05");
    expect(summary.checkin.current).toBe(3); // Nov 3 (answers), Nov 4 and 5 (habits)
    expect(summary.habits.map((h) => [h.habit.name, h.streak.current])).toEqual([
      ["Stretch", 2],
      ["Read", 0],
    ]);
  });
});

describe("streakHint", () => {
  it("writes a short sentence for each status", () => {
    expect(streakHint(streakOf("D"))).toBe("Done today.");
    expect(streakHint(streakOf("DD."))).toBe("Not done yet today.");
    expect(streakHint(streakOf("DD.."))).toContain("freeze");
    expect(streakHint(computeStreak([], "2026-11-05"))).toBe("No streak yet.");
    expect(streakHint(streakOf("D..."))).toContain("start again");
  });
});
