import { describe, expect, it } from "vitest";
import {
  countsParts,
  defaultProgressUnit,
  formatProgress,
  incrementProgress,
  parseProgressText,
  progressFieldLabel,
  progressPercent,
  progressStep,
  progressUnitsFor,
  reachedEnd,
  stepLabel,
  validateProgress,
} from "./progress";

describe("progress units per media type", () => {
  it("gives each type the units that make sense for it", () => {
    expect(progressUnitsFor("movie")).toEqual([]);
    expect(progressUnitsFor("series")).toEqual(["episode"]);
    expect(progressUnitsFor("anime")).toEqual(["episode"]);
    expect(progressUnitsFor("manga")).toEqual(["chapter"]);
    expect(progressUnitsFor("book")).toEqual(["page", "percent"]);
    expect(progressUnitsFor("game")).toEqual(["hour"]);
  });

  it("uses the first unit as the default, and none for movies", () => {
    expect(defaultProgressUnit("book")).toBe("page");
    expect(defaultProgressUnit("game")).toBe("hour");
    expect(defaultProgressUnit("movie")).toBeNull();
  });

  it("knows which units count parts of a total", () => {
    expect(["episode", "chapter", "page"].every((u) => countsParts(u as "episode"))).toBe(true);
    expect(countsParts("percent")).toBe(false);
    expect(countsParts("hour")).toBe(false);
  });
});

describe("validateProgress", () => {
  it("accepts no progress at all, even for movies", () => {
    expect(validateProgress("movie", null, null, null)).toEqual({ ok: true, value: { progress: null, progress_unit: null } });
    expect(validateProgress("anime", undefined, "episode", 24)).toEqual({
      ok: true,
      value: { progress: null, progress_unit: null },
    });
  });

  it("accepts episode 7 of 24 and fills in the default unit", () => {
    expect(validateProgress("anime", 7, null, 24)).toEqual({ ok: true, value: { progress: 7, progress_unit: "episode" } });
  });

  it("accepts any chapter when the total is unknown (120/?)", () => {
    expect(validateProgress("manga", 120, "chapter", null)).toEqual({
      ok: true,
      value: { progress: 120, progress_unit: "chapter" },
    });
  });

  it("accepts 0 (started, nothing done yet) and the very last episode", () => {
    expect(validateProgress("series", 0, "episode", 10).ok).toBe(true);
    expect(validateProgress("series", 10, "episode", 10).ok).toBe(true);
  });

  it("refuses going past the total", () => {
    const result = validateProgress("anime", 25, "episode", 24);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("only has 24 episodes") });
    expect(validateProgress("anime", 2, "episode", 1)).toEqual({ ok: false, error: expect.stringContaining("1 episode,") });
  });

  it("refuses progress for movies", () => {
    expect(validateProgress("movie", 1, null, null)).toEqual({ ok: false, error: expect.stringContaining("Movies") });
  });

  it("refuses a unit that doesn't fit the type, or an unknown one", () => {
    expect(validateProgress("book", 5, "hour", 300).ok).toBe(false);
    expect(validateProgress("anime", 5, "chapter", 24).ok).toBe(false);
    expect(validateProgress("anime", 5, "minutes", 24).ok).toBe(false);
  });

  it("refuses negatives, text, NaN and huge typos", () => {
    expect(validateProgress("anime", -1, "episode", null).ok).toBe(false);
    expect(validateProgress("anime", "7", "episode", null).ok).toBe(false);
    expect(validateProgress("anime", Number.NaN, "episode", null).ok).toBe(false);
    expect(validateProgress("game", 1_000_000, "hour", null).ok).toBe(false);
  });

  it("wants whole numbers for episodes, chapters, pages and percent", () => {
    expect(validateProgress("anime", 7.5, "episode", null)).toEqual({ ok: false, error: "Use a whole number of episodes." });
    expect(validateProgress("book", 45.5, "percent", null).ok).toBe(false);
  });

  it("allows books in pages (up to the page count) or in percent (up to 100)", () => {
    expect(validateProgress("book", 270, "page", 604)).toEqual({ ok: true, value: { progress: 270, progress_unit: "page" } });
    expect(validateProgress("book", 605, "page", 604).ok).toBe(false);
    // The page count doesn't limit a percentage.
    expect(validateProgress("book", 45, "percent", 30)).toEqual({ ok: true, value: { progress: 45, progress_unit: "percent" } });
    expect(validateProgress("book", 101, "percent", null)).toEqual({ ok: false, error: "A percentage goes up to 100." });
  });

  it("allows hours with one decimal, rounding float noise", () => {
    expect(validateProgress("game", 12.5, "hour", null)).toEqual({ ok: true, value: { progress: 12.5, progress_unit: "hour" } });
    expect(validateProgress("game", 0.1 + 0.2, "hour", null)).toEqual({ ok: true, value: { progress: 0.3, progress_unit: "hour" } });
    expect(validateProgress("game", 12.34, null, null)).toEqual({ ok: true, value: { progress: 12.3, progress_unit: "hour" } });
  });
});

describe("progressPercent", () => {
  it("divides by the total and rounds down (23/24 is not done yet)", () => {
    expect(progressPercent(7, "episode", 24)).toBe(29);
    expect(progressPercent(23, "episode", 24)).toBe(95);
    expect(progressPercent(24, "episode", 24)).toBe(100);
    expect(progressPercent(0, "page", 604)).toBe(0);
  });

  it("is the number itself for percent", () => {
    expect(progressPercent(45, "percent", null)).toBe(45);
  });

  it("is unknown for hours, unknown totals and no progress", () => {
    expect(progressPercent(12, "hour", null)).toBeNull();
    expect(progressPercent(120, "chapter", null)).toBeNull();
    expect(progressPercent(null, null, 24)).toBeNull();
  });
});

describe("formatProgress", () => {
  it("writes episodes and chapters as x/total, with ? when unknown", () => {
    expect(formatProgress(7, "episode", 24)).toBe("Episode 7/24");
    expect(formatProgress(120, "chapter", null)).toBe("Chapter 120/?");
  });

  it("adds the percent for pages when the page count is known", () => {
    expect(formatProgress(270, "page", 604)).toBe("Page 270/604 (44%)");
    expect(formatProgress(270, "page", null)).toBe("Page 270/?");
  });

  it("writes percent and hours", () => {
    expect(formatProgress(45, "percent", 604)).toBe("45%");
    expect(formatProgress(12.5, "hour", null)).toBe("12.5 hours");
    expect(formatProgress(1, "hour", null)).toBe("1 hour");
  });

  it("is null without progress", () => {
    expect(formatProgress(null, null, 24)).toBeNull();
  });
});

describe("the quick + button", () => {
  it("has a step and a label per unit", () => {
    expect(progressStep("episode")).toBe(1);
    expect(progressStep("page")).toBe(10);
    expect(progressStep("percent")).toBe(5);
    expect(stepLabel("episode")).toBe("+1 ep");
    expect(stepLabel("chapter")).toBe("+1 ch");
    expect(stepLabel("page")).toBe("+10 p.");
    expect(stepLabel("percent")).toBe("+5%");
    expect(stepLabel("hour")).toBe("+1 h");
  });

  it("adds one step, starting from 0 when there's no progress yet", () => {
    expect(incrementProgress(7, "episode", 24)).toBe(8);
    expect(incrementProgress(null, "episode", 24)).toBe(1);
    expect(incrementProgress(120, "chapter", null)).toBe(121);
    expect(incrementProgress(12.5, "hour", null)).toBe(13.5);
  });

  it("never goes past the end", () => {
    expect(incrementProgress(24, "episode", 24)).toBe(24);
    expect(incrementProgress(598, "page", 604)).toBe(604);
    expect(incrementProgress(98, "percent", null)).toBe(100);
  });
});

describe("reachedEnd", () => {
  it("is true at the last episode, last page or 100%", () => {
    expect(reachedEnd(24, "episode", 24)).toBe(true);
    expect(reachedEnd(604, "page", 604)).toBe(true);
    expect(reachedEnd(100, "percent", null)).toBe(true);
  });

  it("is false before the end, for unknown totals and for hours", () => {
    expect(reachedEnd(23, "episode", 24)).toBe(false);
    expect(reachedEnd(1000, "chapter", null)).toBe(false);
    expect(reachedEnd(100, "hour", null)).toBe(false);
    expect(reachedEnd(null, null, 24)).toBe(false);
  });
});

describe("the progress box", () => {
  it("turns the typed text into a number, or null when empty", () => {
    expect(parseProgressText("")).toBeNull();
    expect(parseProgressText("   ")).toBeNull();
    expect(parseProgressText("7")).toBe(7);
    expect(parseProgressText(" 12.5 ")).toBe(12.5);
    expect(parseProgressText("12,5")).toBe(12.5); // comma like in French
    expect(parseProgressText("abc")).toBeNaN();
  });

  it("has a label per type", () => {
    expect(progressFieldLabel("anime")).toBe("Episodes watched");
    expect(progressFieldLabel("manga")).toBe("Chapters read");
    expect(progressFieldLabel("game")).toBe("Hours played");
  });
});
