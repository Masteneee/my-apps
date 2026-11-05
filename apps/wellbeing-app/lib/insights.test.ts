import { describe, expect, it } from "vitest";
import type { CheckinDay, Habit, HabitEntry } from "./checkin/types";
import {
  average,
  buildWeeklySummary,
  dayCount,
  formatMood,
  habitMoodInsight,
  habitMoodInsights,
  habitSentence,
  habitStartDate,
  insightWindow,
  MIN_DAYS_EACH_SIDE,
  moodTrend,
  trendSentence,
  weeklyMoods,
  type WeekMood,
} from "./insights";

// 2026-11-05 is a THURSDAY. This week = Mon Nov 2 to today. Last week =
// Oct 26 to Sun Nov 1, the day Toronto's clocks went back (a 25-hour day).
const TODAY = "2026-11-05";

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "stretch",
    user_id: "me",
    name: "Stretch",
    icon: null,
    type: "checkbox",
    target: null,
    is_archived: false,
    created_at: "2026-09-01T12:00:00.000Z",
    ...overrides,
  };
}

function entry(date: string, habitId = "stretch", value = 1): HabitEntry {
  return { habit_id: habitId, user_id: "me", date, value };
}

/** { "2026-11-02": 4, ... } -> CheckinDay[] */
function moods(byDate: Record<string, number | null>): CheckinDay[] {
  return Object.entries(byDate).map(([date, mood]) => ({ date, mood }));
}

function moodMap(byDate: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(byDate));
}

describe("average", () => {
  it("is null for no numbers (there is no average of nothing)", () => {
    expect(average([])).toBeNull();
  });

  it("adds up and divides", () => {
    expect(average([4])).toBe(4);
    expect(average([1, 2, 4])).toBeCloseTo(7 / 3);
  });
});

describe("weeklyMoods", () => {
  it("gives 8 weeks, Monday to Sunday, oldest first, the last one ending today", () => {
    const weeks = weeklyMoods([], TODAY);
    expect(weeks).toHaveLength(8);
    expect(weeks[7]).toEqual({ weekStart: "2026-11-02", weekEnd: TODAY, moodDays: 0, average: null, isCurrent: true });
    expect(weeks[6]).toMatchObject({ weekStart: "2026-10-26", weekEnd: "2026-11-01", isCurrent: false });
    expect(weeks[0].weekStart).toBe("2026-09-14");
  });

  it("averages only the days with a mood, in the right week", () => {
    const weeks = weeklyMoods(
      moods({
        "2026-11-02": 4, // Monday, this week
        "2026-11-04": 5,
        "2026-11-03": null, // a check-in with no mood: left out, not counted as bad
        "2026-11-01": 2, // Sunday (clocks went back): still LAST week
        "2026-10-26": 3,
      }),
      TODAY,
    );
    expect(weeks[7]).toMatchObject({ moodDays: 2, average: 4.5 });
    expect(weeks[6]).toMatchObject({ moodDays: 2, average: 2.5 });
  });

  it("ignores days after today and impossible moods", () => {
    const weeks = weeklyMoods(moods({ "2026-11-06": 1, "2026-11-02": 9, "2026-11-03": 0, "2026-11-04": 3 }), TODAY);
    expect(weeks[7]).toMatchObject({ moodDays: 1, average: 3 });
  });

  it("on a Monday, this week is just today", () => {
    const weeks = weeklyMoods(moods({ "2026-11-09": 4, "2026-11-08": 2 }), "2026-11-09");
    expect(weeks[7]).toMatchObject({ weekStart: "2026-11-09", weekEnd: "2026-11-09", moodDays: 1, average: 4 });
    expect(weeks[6]).toMatchObject({ weekEnd: "2026-11-08", moodDays: 1, average: 2 });
  });

  it("handles the spring clock change too (a 23-hour Sunday)", () => {
    const weeks = weeklyMoods(moods({ "2026-03-08": 5, "2026-03-09": 1 }), "2026-03-10");
    expect(weeks[6]).toMatchObject({ weekStart: "2026-03-02", weekEnd: "2026-03-08", average: 5 });
    expect(weeks[7]).toMatchObject({ weekStart: "2026-03-09", average: 1 });
  });
});

describe("moodTrend", () => {
  function week(average: number | null, moodDays: number): WeekMood {
    return { weekStart: "x", weekEnd: "x", moodDays, average, isCurrent: false };
  }

  it("says up, down or steady when both weeks have enough days", () => {
    expect(moodTrend([week(3, 5), week(4, 3)])).toMatchObject({ direction: "up", change: 1 });
    expect(moodTrend([week(4, 5), week(3, 3)])).toMatchObject({ direction: "down", change: -1 });
    expect(moodTrend([week(3.5, 5), week(3.7, 3)]).direction).toBe("steady"); // 0.2 is noise
  });

  it("refuses to compare when a week has fewer than 3 mood days", () => {
    expect(moodTrend([week(2, 7), week(5, 2)])).toMatchObject({ direction: "not-enough", change: null });
    expect(moodTrend([week(null, 0), week(4, 5)]).direction).toBe("not-enough");
  });

  it("needs two weeks", () => {
    expect(() => moodTrend([week(3, 5)])).toThrow();
  });
});

describe("insightWindow", () => {
  it("is the 4 weeks up to this one, ending YESTERDAY (today isn't over)", () => {
    expect(insightWindow(TODAY)).toEqual({ from: "2026-10-12", to: "2026-11-04" });
  });

  it("on a Monday, ends on Sunday", () => {
    expect(insightWindow("2026-11-09")).toEqual({ from: "2026-10-19", to: "2026-11-08" });
  });
});

describe("habitStartDate", () => {
  it("is the LOCAL day the habit was made", () => {
    // 3 am UTC on Oct 20 is still 11 pm on Oct 19 in Toronto.
    expect(habitStartDate(habit({ created_at: "2026-10-20T03:00:00.000Z" }), [], "America/Toronto")).toBe("2026-10-19");
    expect(habitStartDate(habit({ created_at: "2026-10-20T03:00:00.000Z" }), [], "Europe/Paris")).toBe("2026-10-20");
  });

  it("is an earlier entry's day if there is one (a past day typed in)", () => {
    const h = habit({ created_at: "2026-10-20T12:00:00.000Z" });
    expect(habitStartDate(h, [entry("2026-10-15"), entry("2026-10-01", "other")], "America/Toronto")).toBe("2026-10-15");
  });

  it("is null when the creation time is broken and there are no entries", () => {
    expect(habitStartDate(habit({ created_at: "not a date" }), [], "America/Toronto")).toBeNull();
  });
});

describe("habitMoodInsight", () => {
  const window = { from: "2026-10-12", to: "2026-11-04" };
  // 8 days with a mood. Stretch done on the 4 good ones.
  const eightDays = {
    "2026-10-20": 5,
    "2026-10-21": 4,
    "2026-10-22": 5,
    "2026-10-23": 4,
    "2026-10-24": 3,
    "2026-10-25": 2,
    "2026-10-26": 3,
    "2026-10-27": 2,
  };
  const doneOnGoodDays = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"].map((d) => entry(d));

  it("compares the average mood on done days with not-done days", () => {
    const result = habitMoodInsight(habit(), moodMap(eightDays), doneOnGoodDays, window);
    expect(result).toMatchObject({ doneDays: 4, notDoneDays: 4, doneAverage: 4.5, notDoneAverage: 2.5, difference: 2 });
    expect(result.verdict).toBe("better");
  });

  it("says 'lower' when mood is lower on done days", () => {
    const doneOnLowDays = ["2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"].map((d) => entry(d));
    const result = habitMoodInsight(habit(), moodMap(eightDays), doneOnLowDays, window);
    expect(result).toMatchObject({ difference: -2, verdict: "lower" });
  });

  it("says 'about the same' for a small difference", () => {
    const flat = { ...eightDays, "2026-10-20": 3, "2026-10-21": 3, "2026-10-22": 3, "2026-10-23": 3 }; // 3 vs 2.5
    const almost = { ...flat, "2026-10-24": 3, "2026-10-26": 3, "2026-10-27": 3 }; // 3 vs 2.75
    expect(habitMoodInsight(habit(), moodMap(flat), doneOnGoodDays, window).verdict).toBe("better"); // 0.5
    expect(habitMoodInsight(habit(), moodMap(almost), doneOnGoodDays, window)).toMatchObject({
      difference: 0.25,
      verdict: "same",
    });
  });

  it(`shows nothing until there are ${MIN_DAYS_EACH_SIDE} days on EACH side, but still counts them`, () => {
    const result = habitMoodInsight(habit(), moodMap(eightDays), doneOnGoodDays.slice(0, 3), window);
    // 3 done, 5 not done: not enough done days.
    expect(result).toMatchObject({ doneDays: 3, notDoneDays: 5, difference: null, verdict: "not-enough" });
    expect(result.doneAverage).toBeCloseTo(14 / 3);
  });

  it("leaves out days with no mood, days outside the window, and days before the habit existed", () => {
    const result = habitMoodInsight(
      habit({ created_at: "2026-10-21T16:00:00.000Z" }), // made on Oct 21
      moodMap({ ...eightDays, "2026-10-05": 1, "2026-11-05": 1 }), // before the window / today
      [...doneOnGoodDays.slice(1), entry("2026-10-28")], // Oct 28: done, but no mood that day
      window,
    );
    // Oct 20 is before the habit existed. Left: done 21, 22, 23; not done 24 to 27.
    expect(result).toMatchObject({ doneDays: 3, notDoneDays: 4 });
  });

  it("a habit with a daily goal only counts as done when the goal is reached", () => {
    const water = habit({ id: "water", name: "Water", type: "number", target: 8 });
    const entries = [
      ...["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"].map((d) => entry(d, "water", 8)),
      entry("2026-10-24", "water", 5), // a good start, but not done
    ];
    expect(habitMoodInsight(water, moodMap(eightDays), entries, window)).toMatchObject({ doneDays: 4, notDoneDays: 4 });
  });
});

describe("habitMoodInsights", () => {
  it("puts habits with enough data first (biggest difference first), then the rest in order", () => {
    const days = moods({
      "2026-10-20": 5,
      "2026-10-21": 5,
      "2026-10-22": 5,
      "2026-10-23": 5,
      "2026-10-24": 1,
      "2026-10-25": 1,
      "2026-10-26": 1,
      "2026-10-27": 1,
    });
    const good = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"];
    const mixed = ["2026-10-20", "2026-10-21", "2026-10-24", "2026-10-25"];
    const habits = [
      habit({ id: "new", name: "New" }), // no entries in a while: all not-done -> not enough
      habit({ id: "mixed", name: "Mixed" }),
      habit({ id: "good", name: "Good" }),
    ];
    const entries = [...good.map((d) => entry(d, "good")), ...mixed.map((d) => entry(d, "mixed"))];
    const result = habitMoodInsights(habits, days, entries, { from: "2026-10-12", to: "2026-11-04" });
    expect(result.map((i) => [i.habit.name, i.verdict])).toEqual([
      ["Good", "better"],
      ["Mixed", "same"],
      ["New", "not-enough"],
    ]);
  });
});

describe("buildWeeklySummary", () => {
  it("puts it all together, with this week's check-in and habit days", () => {
    const summary = buildWeeklySummary({
      habits: [habit()],
      checkinDays: moods({ "2026-11-02": 4, "2026-11-03": null, "2026-10-30": 3 }),
      entries: [entry("2026-11-02"), entry("2026-11-04"), entry("2026-11-01")], // Nov 1 is last week
      today: TODAY,
    });
    expect(summary.window).toEqual({ from: "2026-10-12", to: "2026-11-04" });
    expect(summary.weeks).toHaveLength(8);
    expect(summary.trend.direction).toBe("not-enough");
    // Nov 2, 3 (check-in, no mood) and 4 (habit only).
    expect(summary.thisWeek.checkinDays).toBe(3);
    expect(summary.thisWeek.habitDays).toEqual([{ habit: habit(), days: 2 }]);
    expect(summary.habits[0].verdict).toBe("not-enough");
  });
});

describe("words for the screen", () => {
  it("rounds moods to one decimal", () => {
    expect(formatMood(23 / 6)).toBe("3.8");
    expect(formatMood(4)).toBe("4.0");
    expect(formatMood(null)).toBe("–");
    expect(dayCount(1)).toBe("1 day");
    expect(dayCount(0)).toBe("0 days");
  });

  it("explains a missing comparison with the real numbers", () => {
    const weeks = weeklyMoods(moods({ "2026-11-02": 4 }), TODAY);
    expect(trendSentence(moodTrend(weeks))).toContain("this week 1, last week 0");
  });

  it("describes each verdict", () => {
    const base = { doneDays: 2, notDoneDays: 6, doneAverage: 4, notDoneAverage: 3, difference: null };
    expect(habitSentence({ ...base, habit: habit(), verdict: "not-enough" })).toContain("now 2 and 6");
    expect(habitSentence({ ...base, habit: habit(), verdict: "better", difference: 1 })).toContain("higher");
    expect(habitSentence({ ...base, habit: habit(), verdict: "same", difference: 0.1 })).toContain("about the same");
  });
});
