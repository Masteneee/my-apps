import { describe, expect, it } from "vitest";
import { addDays } from "../checkin/date";
import {
  bothDoneDates,
  computeSharedStreak,
  friendName,
  nudges,
  nudgeText,
  sharedStreakHint,
  splitSharedDays,
  summarizeSharedStreaks,
} from "./shared-streaks";
import type { SharedStreakView } from "./types";

const TODAY = "2026-11-05";

describe("bothDoneDates", () => {
  it("keeps only the days both people did it, sorted, each once", () => {
    expect(bothDoneDates(["2026-11-03", "2026-11-01", "2026-11-01", "2026-11-02"], ["2026-11-02", "2026-11-01"])).toEqual([
      "2026-11-01",
      "2026-11-02",
    ]);
    expect(bothDoneDates(["2026-11-01"], [])).toEqual([]);
  });
});

describe("computeSharedStreak: it goes up only on days you BOTH did it", () => {
  it("counts the days in a row you both did it", () => {
    const mine = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"];
    const theirs = ["2026-11-02", "2026-11-03", "2026-11-04"];
    const { streak } = computeSharedStreak(mine, theirs, TODAY);
    expect(streak.current).toBe(3); // Nov 1 was only me
    expect(streak.status).toBe("pending"); // today isn't over
  });

  it("a day only one of you did is a missed day for the pair, and a freeze can cover it", () => {
    const mine = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"];
    const theirs = ["2026-11-01", "2026-11-03", "2026-11-04"]; // friend missed Nov 2
    const { streak } = computeSharedStreak(mine, theirs, TODAY);
    expect(streak.frozenDays).toEqual(["2026-11-02"]);
    expect(streak.current).toBe(3); // Nov 1, 3, 4 (the frozen day doesn't add)
  });

  it("two days in a row not done by both ends the shared streak", () => {
    const mine = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"];
    const theirs = ["2026-11-01", "2026-11-04"];
    const { streak } = computeSharedStreak(mine, theirs, TODAY);
    expect(streak.missedDays).toEqual(["2026-11-02", "2026-11-03"]);
    expect(streak.current).toBe(1);
    expect(streak.best).toBe(1);
  });

  it("the pair shares ONE freeze per 7 days", () => {
    // Both did every day from Oct 25 to Nov 4, except: friend missed Oct 27, I missed Oct 30.
    const all = Array.from({ length: 11 }, (_, i) => addDays("2026-10-25", i));
    const mine = all.filter((d) => d !== "2026-10-30");
    const theirs = all.filter((d) => d !== "2026-10-27");
    const { streak } = computeSharedStreak(mine, theirs, TODAY);
    expect(streak.frozenDays).toEqual(["2026-10-27"]); // the first one is frozen...
    expect(streak.missedDays).toEqual(["2026-10-30"]); // ...the second, 3 days later, isn't
    expect(streak.current).toBe(5); // Oct 31 to Nov 4
  });

  it("today counts once you have both done it", () => {
    const result = computeSharedStreak(["2026-11-04", TODAY], ["2026-11-04", TODAY], TODAY);
    expect(result.streak.current).toBe(2);
    expect(result.streak.status).toBe("done-today");
    expect(result.nudge).toBe(false);
  });

  it("ignores days after MY today (a friend in a time zone ahead of mine)", () => {
    const result = computeSharedStreak([TODAY, "2026-11-06"], ["2026-11-06"], TODAY);
    expect(result.streak.current).toBe(0);
  });
});

describe("the nudge: your friend checked in, your turn", () => {
  it("is on when my friend did it today and I haven't", () => {
    const result = computeSharedStreak(["2026-11-04"], ["2026-11-04", TODAY], TODAY);
    expect(result.nudge).toBe(true);
    expect(result.friendDoneToday).toBe(true);
    expect(result.meDoneToday).toBe(false);
    expect(sharedStreakHint(result, "Sam")).toBe("Sam did it today. Your turn when you're ready.");
    expect(nudgeText("Sam", "Stretch")).toBe("Sam checked in for Stretch. Your turn!");
  });

  it("is off when I already did it, or when my friend hasn't", () => {
    const meFirst = computeSharedStreak([TODAY], [], TODAY);
    expect(meFirst.nudge).toBe(false);
    expect(sharedStreakHint(meFirst, "Sam")).toBe("You did it today. Waiting for Sam.");

    const neither = computeSharedStreak(["2026-11-04"], ["2026-11-04"], TODAY);
    expect(neither.nudge).toBe(false);
    expect(sharedStreakHint(neither, "Sam")).toBe("Neither of you has done it yet today.");
  });
});

describe("sharedStreakHint", () => {
  it("explains a day at risk, a lost streak and a new one", () => {
    // Both did Nov 3, nobody did Nov 4 (yesterday): a freeze can still save it.
    expect(sharedStreakHint(computeSharedStreak(["2026-11-03"], ["2026-11-03"], TODAY), "Sam")).toContain("freeze");
    expect(sharedStreakHint(computeSharedStreak(["2026-11-01"], ["2026-11-01"], TODAY), "Sam")).toContain("start again");
    expect(sharedStreakHint(computeSharedStreak([], [], TODAY), "Sam")).toBe("Do it on the same day to start a streak.");
    expect(sharedStreakHint(computeSharedStreak([TODAY], [TODAY], TODAY), "Sam")).toBe("You both did it today.");
  });
});

describe("splitSharedDays and summarizeSharedStreaks", () => {
  const sam = { id: "sam", username: "sam", display_name: null };
  const view = (id: string, status: "pending" | "active"): SharedStreakView => ({
    id,
    habit_name: "Stretch",
    status,
    direction: "outgoing",
    friend: sam,
    myHabitId: "h1",
    created_at: "t",
  });

  it("splits the function's rows into mine and my friend's", () => {
    const rows = [
      { user_id: "me", date: "2026-11-04" },
      { user_id: "sam", date: "2026-11-04" },
      { user_id: "sam", date: TODAY },
    ];
    expect(splitSharedDays(rows, "me")).toEqual({ mine: ["2026-11-04"], theirs: ["2026-11-04", TODAY] });
  });

  it("works out every active shared streak, skips invites, and lists the nudges", () => {
    const days = new Map([
      ["s1", [{ user_id: "sam", date: TODAY }]],
      ["s2", [{ user_id: "me", date: TODAY }]],
    ]);
    const summaries = summarizeSharedStreaks([view("s1", "active"), view("s2", "active"), view("s3", "pending")], days, "me", TODAY);
    expect(summaries.map((s) => s.view.id)).toEqual(["s1", "s2"]);
    expect(nudges(summaries).map((s) => s.view.id)).toEqual(["s1"]);
  });

  it("friendName prefers the display name", () => {
    expect(friendName({ username: "sam_demo", display_name: "Sam" })).toBe("Sam");
    expect(friendName({ username: "sam_demo", display_name: "  " })).toBe("sam_demo");
  });
});
