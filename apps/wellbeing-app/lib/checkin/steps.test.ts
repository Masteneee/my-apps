import { describe, expect, it } from "vitest";
import { emptyFields } from "./merge";
import { addMinutes, answeredCount, formatMinutes, isStepAnswered, moodFor, STEPS } from "./steps";

describe("the steps", () => {
  it("go mood → screen time → gratitude → journal → habits", () => {
    expect(STEPS.map((step) => step.id)).toEqual(["mood", "screen", "gratitude", "journal", "habits"]);
  });

  it("count as answered only when something was filled in", () => {
    const empty = emptyFields();
    for (const step of STEPS) expect(isStepAnswered(step.id, empty, 0)).toBe(false);

    expect(isStepAnswered("mood", { ...empty, mood: 1 }, 0)).toBe(true);
    expect(isStepAnswered("screen", { ...empty, screen_time_minutes: 0 }, 0)).toBe(true); // 0 min is an answer
    expect(isStepAnswered("gratitude", { ...empty, gratitude: ["", "  ", "rain"] }, 0)).toBe(true);
    expect(isStepAnswered("gratitude", { ...empty, gratitude: ["", "  ", ""] }, 0)).toBe(false);
    expect(isStepAnswered("journal", { ...empty, journal_text: "  " }, 0)).toBe(false);
    expect(isStepAnswered("habits", empty, 2)).toBe(true);
  });

  it("can be counted for the summary", () => {
    expect(answeredCount({ ...emptyFields(), mood: 4, journal_text: "ok" }, 1)).toBe(3);
  });
});

describe("moodFor", () => {
  it("finds the emoji and word for a mood number", () => {
    expect(moodFor(5)?.label).toBe("Great");
    expect(moodFor(null)).toBeNull();
  });
});

describe("screen time helpers", () => {
  it("write minutes for people", () => {
    expect(formatMinutes(null)).toBe("Not set");
    expect(formatMinutes(0)).toBe("0 min");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(135)).toBe("2 h 15 min");
  });

  it("add and remove time, staying between 0 and 24 h", () => {
    expect(addMinutes(null, 15)).toBe(15);
    expect(addMinutes(10, -15)).toBe(0);
    expect(addMinutes(1430, 15)).toBe(1440);
  });
});
