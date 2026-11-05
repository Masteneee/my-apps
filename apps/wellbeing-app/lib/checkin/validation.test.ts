import { describe, expect, it } from "vitest";
import {
  cleanCheckinPatch,
  cleanGratitude,
  cleanJournal,
  cleanMoodTags,
  JOURNAL_MAX,
  validateCheckinPatch,
  validateEntryValue,
  validateNewHabit,
} from "./validation";

describe("cleaning check-in answers", () => {
  it("always gives 3 trimmed gratitude slots", () => {
    expect(cleanGratitude([" tea ", "sun"])).toEqual(["tea", "sun", ""]);
    expect(cleanGratitude(["a", "b", "c", "d"])).toEqual(["a", "b", "c"]);
    expect(cleanGratitude(null)).toEqual(["", "", ""]);
  });

  it("lowercases mood words and removes blanks and repeats", () => {
    expect(cleanMoodTags(["Calm", " calm ", "", "Tired"])).toEqual(["calm", "tired"]);
  });

  it("stores an empty journal as null", () => {
    expect(cleanJournal("   ")).toBeNull();
    expect(cleanJournal("")).toBeNull();
    expect(cleanJournal("  A good day.\n")).toBe("A good day.");
  });

  it("only touches the fields that are in the patch (partial save)", () => {
    expect(cleanCheckinPatch({ mood: 4 })).toEqual({ mood: 4 });
    expect(cleanCheckinPatch({ journal_text: " hi " })).toEqual({ journal_text: "hi" });
    expect(cleanCheckinPatch({})).toEqual({});
  });

  it("keeps null as 'clear this answer'", () => {
    expect(cleanCheckinPatch({ mood: null, screen_time_minutes: null })).toEqual({
      mood: null,
      screen_time_minutes: null,
    });
  });

  it("rounds screen time to whole minutes", () => {
    expect(cleanCheckinPatch({ screen_time_minutes: 90.6 })).toEqual({ screen_time_minutes: 91 });
  });
});

describe("validateCheckinPatch", () => {
  it("accepts a normal check-in, cleaned", () => {
    const result = validateCheckinPatch({
      mood: 5,
      mood_tags: ["Happy"],
      screen_time_minutes: 120,
      gratitude: ["friends"],
      journal_text: "Nice walk. ",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        mood: 5,
        mood_tags: ["happy"],
        screen_time_minutes: 120,
        gratitude: ["friends", "", ""],
        journal_text: "Nice walk.",
      },
    });
  });

  it("accepts an empty patch (everything skipped)", () => {
    expect(validateCheckinPatch({})).toEqual({ ok: true, value: {} });
  });

  it("refuses a mood outside 1 to 5", () => {
    expect(validateCheckinPatch({ mood: 0 }).ok).toBe(false);
    expect(validateCheckinPatch({ mood: 6 }).ok).toBe(false);
    expect(validateCheckinPatch({ mood: 2.5 }).ok).toBe(false);
  });

  it("refuses impossible screen times", () => {
    expect(validateCheckinPatch({ screen_time_minutes: -5 }).ok).toBe(false);
    expect(validateCheckinPatch({ screen_time_minutes: 1441 }).ok).toBe(false);
    expect(validateCheckinPatch({ screen_time_minutes: Number.NaN }).ok).toBe(false);
    expect(validateCheckinPatch({ screen_time_minutes: 1440 }).ok).toBe(true);
  });

  it("refuses too many or too long mood words", () => {
    expect(validateCheckinPatch({ mood_tags: ["a", "b", "c", "d", "e", "f"] }).ok).toBe(false);
    expect(validateCheckinPatch({ mood_tags: ["x".repeat(25)] }).ok).toBe(false);
  });

  it("refuses a gratitude line or journal that is too long", () => {
    expect(validateCheckinPatch({ gratitude: ["x".repeat(201)] }).ok).toBe(false);
    expect(validateCheckinPatch({ journal_text: "x".repeat(JOURNAL_MAX + 1) }).ok).toBe(false);
    // Spaces around the text don't count against the limit (they're trimmed first).
    expect(validateCheckinPatch({ journal_text: ` ${"x".repeat(JOURNAL_MAX)} ` }).ok).toBe(true);
  });
});

describe("validateNewHabit", () => {
  it("cleans the name and keeps the target for number habits", () => {
    expect(validateNewHabit({ name: "  Drink   water ", type: "number", target: 8, icon: " 💧 " })).toEqual({
      ok: true,
      value: { name: "Drink water", type: "number", target: 8, icon: "💧" },
    });
  });

  it("drops the target of a checkbox habit (nothing to count)", () => {
    expect(validateNewHabit({ name: "Stretch", type: "checkbox", target: 3 })).toEqual({
      ok: true,
      value: { name: "Stretch", type: "checkbox", target: null, icon: "" },
    });
  });

  it("needs a name of at most 40 characters", () => {
    expect(validateNewHabit({ name: "   ", type: "checkbox" }).ok).toBe(false);
    expect(validateNewHabit({ name: "x".repeat(41), type: "checkbox" }).ok).toBe(false);
  });

  it("refuses an unknown type", () => {
    expect(validateNewHabit({ name: "Read", type: "hours" as never }).ok).toBe(false);
  });

  it("checks the daily goal against the type", () => {
    expect(validateNewHabit({ name: "Read", type: "minutes", target: 20 }).ok).toBe(true);
    expect(validateNewHabit({ name: "Read", type: "minutes", target: 1441 }).ok).toBe(false);
    expect(validateNewHabit({ name: "Water", type: "number", target: 0 }).ok).toBe(false);
    expect(validateNewHabit({ name: "Water", type: "number", target: 1.5 }).ok).toBe(false);
    expect(validateNewHabit({ name: "Water", type: "number", target: null }).ok).toBe(true);
  });

  it("allows one emoji as the icon, not a sentence", () => {
    expect(validateNewHabit({ name: "Run", type: "checkbox", icon: "🏃‍♀️" }).ok).toBe(true);
    expect(validateNewHabit({ name: "Run", type: "checkbox", icon: "running fast" }).ok).toBe(false);
  });
});

describe("validateEntryValue", () => {
  it("turns any 'yes' into 1 for a checkbox, and 'no' into remove", () => {
    expect(validateEntryValue({ type: "checkbox" }, 1)).toEqual({ ok: true, value: 1 });
    expect(validateEntryValue({ type: "checkbox" }, 7)).toEqual({ ok: true, value: 1 });
    expect(validateEntryValue({ type: "checkbox" }, 0)).toEqual({ ok: true, value: null });
    expect(validateEntryValue({ type: "checkbox" }, null)).toEqual({ ok: true, value: null });
  });

  it("keeps amounts, and treats 0 as 'not done' (remove)", () => {
    expect(validateEntryValue({ type: "number" }, 6)).toEqual({ ok: true, value: 6 });
    expect(validateEntryValue({ type: "minutes" }, 0)).toEqual({ ok: true, value: null });
  });

  it("refuses negative, fractional or too-big amounts", () => {
    expect(validateEntryValue({ type: "number" }, -1).ok).toBe(false);
    expect(validateEntryValue({ type: "number" }, 2.5).ok).toBe(false);
    expect(validateEntryValue({ type: "minutes" }, 1441).ok).toBe(false);
  });
});
