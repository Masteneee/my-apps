import { describe, expect, it } from "vitest";
import {
  buildCalendarGrid,
  DEFAULT_WEEKS,
  HABIT_DONE_LEVEL,
  habitLevel,
  habitLevels,
  moodLevels,
  shortDate,
  startOfWeek,
} from "./calendar";

// Nov 5 2026 is a Thursday.
const TODAY = "2026-11-05";

describe("startOfWeek", () => {
  it("finds the Monday (default) or the Sunday the week started on", () => {
    expect(startOfWeek(TODAY)).toBe("2026-11-02"); // Monday
    expect(startOfWeek(TODAY, 0)).toBe("2026-11-01"); // Sunday
    expect(startOfWeek("2026-11-08")).toBe("2026-11-02"); // a Sunday belongs to the week that started Monday
    expect(startOfWeek("2026-11-02")).toBe("2026-11-02"); // a Monday is its own start
  });
});

describe("buildCalendarGrid", () => {
  it("has 12 rows of 7 days, the last row being this week", () => {
    const grid = buildCalendarGrid({ today: TODAY, levels: {} });
    expect(DEFAULT_WEEKS).toBe(12);
    expect(grid.weeks).toHaveLength(12);
    expect(grid.weeks.every((w) => w.days.length === 7)).toBe(true);

    const last = grid.weeks[11];
    expect(last.start).toBe("2026-11-02");
    expect(last.days.map((d) => d.date)).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
    // 11 weeks earlier.
    expect(grid.weeks[0].start).toBe("2026-08-17");
  });

  it("has no gaps or repeats, even across the daylight-saving change (Nov 1)", () => {
    const grid = buildCalendarGrid({ today: TODAY, weeks: 3, levels: {} });
    const dates = grid.weeks.flatMap((w) => w.days.map((d) => d.date));
    expect(dates).toHaveLength(21);
    expect(new Set(dates).size).toBe(21);
    expect(dates).toContain("2026-11-01");
    expect(dates.slice(5, 9)).toEqual(["2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"]);
  });

  it("marks today, and leaves the days after today empty", () => {
    const grid = buildCalendarGrid({ today: TODAY, weeks: 1, levels: { "2026-11-05": 4, "2026-11-06": 4 } });
    const [, , , thu, fri] = grid.weeks[0].days;
    expect(thu).toMatchObject({ date: TODAY, isToday: true, future: false, level: 4, dayOfMonth: 5 });
    // A level saved for tomorrow (wrong clock) is not shown.
    expect(fri).toMatchObject({ future: true, level: null, isToday: false });
  });

  it("puts each day's level in its square, and null where nothing happened", () => {
    const grid = buildCalendarGrid({ today: TODAY, weeks: 1, levels: { "2026-11-03": 2 } });
    expect(grid.weeks[0].days.map((d) => d.level)).toEqual([null, 2, null, null, null, null, null]);
  });

  it("marks frozen days (but never in the future)", () => {
    const grid = buildCalendarGrid({ today: TODAY, weeks: 1, levels: {}, frozen: ["2026-11-03", "2026-11-07"] });
    expect(grid.weeks[0].days.filter((d) => d.frozen).map((d) => d.date)).toEqual(["2026-11-03"]);
  });

  it("names the weekday columns, Monday or Sunday first", () => {
    expect(buildCalendarGrid({ today: TODAY, levels: {} }).weekdayLabels).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    const sundayFirst = buildCalendarGrid({ today: TODAY, weeks: 1, weekStartsOn: 0, levels: {} });
    expect(sundayFirst.weekdayLabels[0]).toBe("Sun");
    expect(sundayFirst.weeks[0].days[0].date).toBe("2026-11-01");
  });

  it("labels the first row and each row where a new month starts", () => {
    const grid = buildCalendarGrid({ today: TODAY, weeks: 6, levels: {} });
    // Rows start Sep 28, Oct 5, 12, 19, 26, Nov 2.
    expect(grid.weeks.map((w) => w.monthLabel)).toEqual(["Sep", null, null, null, "Nov", null]);
    // The first row contains Oct 1, but its first day is in September: "Sep".
  });

  it("shows at least one week", () => {
    expect(buildCalendarGrid({ today: TODAY, weeks: 0, levels: {} }).weeks).toHaveLength(1);
  });

  it("works across the new year", () => {
    const grid = buildCalendarGrid({ today: "2027-01-02", weeks: 1, levels: {} });
    expect(grid.weeks[0].days[0].date).toBe("2026-12-28");
    expect(grid.weeks[0].days[6].date).toBe("2027-01-03");
    expect(grid.weeks[0].monthLabel).toBe("Dec");
  });
});

describe("shortDate", () => {
  it("writes a day for people", () => {
    expect(shortDate("2026-11-05")).toBe("Nov 5");
    expect(shortDate("2027-01-31")).toBe("Jan 31");
  });
});

describe("moodLevels", () => {
  it("uses the mood (1-5) as the level, and skips days without one", () => {
    expect(
      moodLevels([
        { date: "2026-11-03", mood: 1 },
        { date: "2026-11-04", mood: null },
        { date: "2026-11-05", mood: 5 },
      ]),
    ).toEqual({ "2026-11-03": 1, "2026-11-05": 5 });
  });
});

describe("habitLevel and habitLevels", () => {
  it("done = the top level, for yes/no habits and goals reached", () => {
    expect(HABIT_DONE_LEVEL).toBe(4);
    expect(habitLevel({ type: "checkbox", target: null }, 1)).toBe(4);
    expect(habitLevel({ type: "number", target: 8 }, 8)).toBe(4);
    expect(habitLevel({ type: "number", target: 8 }, 12)).toBe(4);
    expect(habitLevel({ type: "minutes", target: null }, 5)).toBe(4); // no goal: any amount
  });

  it("partway to the goal = levels 1 to 3, never 'done'", () => {
    const water = { type: "number" as const, target: 9 };
    expect(habitLevel(water, 1)).toBe(1);
    expect(habitLevel(water, 3)).toBe(2); // a third
    expect(habitLevel(water, 6)).toBe(3); // two thirds
    expect(habitLevel(water, 8)).toBe(3); // almost, still not done
    expect(habitLevel(water, 0)).toBeNull();
  });

  it("builds the levels for one habit only", () => {
    const entries = [
      { habit_id: "w", user_id: "u", date: "2026-11-04", value: 8 },
      { habit_id: "w", user_id: "u", date: "2026-11-05", value: 2 },
      { habit_id: "other", user_id: "u", date: "2026-11-05", value: 1 },
    ];
    expect(habitLevels({ id: "w", type: "number", target: 8 }, entries)).toEqual({ "2026-11-04": 4, "2026-11-05": 1 });
  });
});
