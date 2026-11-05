import { describe, expect, it } from "vitest";
import type { MediaResult, NewLogInput } from "./types";
import {
  isValidDate,
  localToday,
  mediaItemFields,
  RATING_OPTIONS,
  validateLogInput,
  validateRating,
} from "./validation";

const movie: MediaResult = {
  type: "movie",
  source: "tmdb",
  sourceId: "157336",
  title: "Interstellar",
  originalTitle: null,
  year: 2014,
  coverUrl: "https://image.tmdb.org/t/p/w342/poster.jpg",
  creators: [],
  totalUnits: null,
  overview: "Space.",
};

// A valid form; each test changes only the part it's about.
const base: NewLogInput = {
  media: movie,
  status: "completed",
  rating: 4.5,
  reviewText: "",
  finishedAt: "2026-11-01",
  rewatch: false,
};
const TODAY = "2026-11-05";

describe("validateRating", () => {
  it("accepts every half step from 0.5 to 5", () => {
    for (const rating of [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]) {
      expect(validateRating(rating)).toEqual({ ok: true, value: rating });
    }
  });

  it("treats no rating as fine (null)", () => {
    expect(validateRating(null)).toEqual({ ok: true, value: null });
    expect(validateRating(undefined)).toEqual({ ok: true, value: null });
  });

  it("refuses ratings outside 0.5 to 5", () => {
    for (const rating of [0, -1, 5.5, 10]) {
      expect(validateRating(rating).ok).toBe(false);
    }
  });

  it("refuses ratings that aren't half steps", () => {
    for (const rating of [3.3, 4.25, 1.1 + 2.2, 4.999]) {
      const result = validateRating(rating);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("half stars");
    }
  });

  it("refuses things that aren't numbers", () => {
    expect(validateRating("4").ok).toBe(false);
    expect(validateRating(NaN).ok).toBe(false);
    expect(validateRating(Infinity).ok).toBe(false);
  });

  it("offers exactly the ten valid ratings in the form", () => {
    expect(RATING_OPTIONS).toEqual([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
    expect(RATING_OPTIONS.every((r) => validateRating(r).ok)).toBe(true);
  });
});

describe("dates", () => {
  it("formats today in local time as YYYY-MM-DD", () => {
    // new Date(year, monthIndex, day) is local time; months start at 0.
    expect(localToday(new Date(2026, 0, 7, 23, 30))).toBe("2026-01-07");
  });

  it("knows real dates from fake ones", () => {
    expect(isValidDate("2024-02-29")).toBe(true); // leap year
    expect(isValidDate("2026-02-29")).toBe(false);
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("2026-1-5")).toBe(false);
    expect(isValidDate("yesterday")).toBe(false);
  });
});

describe("validateLogInput", () => {
  it("accepts a normal log and cleans it", () => {
    const result = validateLogInput({ ...base, reviewText: "  Loved the docking scene.  ", rewatch: true }, TODAY);
    expect(result).toEqual({
      ok: true,
      value: {
        status: "completed",
        rating: 4.5,
        review_text: "Loved the docking scene.",
        finished_at: "2026-11-01",
        rewatch: true,
      },
    });
  });

  it("stores an empty review as null", () => {
    const result = validateLogInput({ ...base, reviewText: "   " }, TODAY);
    expect(result.ok && result.value.review_text).toBeNull();
  });

  it("refuses an unknown status", () => {
    const result = validateLogInput({ ...base, status: "binged" as NewLogInput["status"] }, TODAY);
    expect(result.ok).toBe(false);
  });

  it("refuses a bad rating with the rating's own message", () => {
    const result = validateLogInput({ ...base, rating: 3.7 }, TODAY);
    expect(result).toEqual({ ok: false, error: "The rating must be in half stars (like 3 or 3.5)." });
  });

  it("refuses rating a movie you only plan to watch", () => {
    expect(validateLogInput({ ...base, status: "planned", rating: 4 }, TODAY).ok).toBe(false);
    expect(validateLogInput({ ...base, status: "planned", rating: null }, TODAY).ok).toBe(true);
  });

  it("refuses a review that's too long", () => {
    const result = validateLogInput({ ...base, reviewText: "a".repeat(5001) }, TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("5001/5000");
  });

  it("allows today but not the future as the watched date", () => {
    expect(validateLogInput({ ...base, finishedAt: TODAY }, TODAY).ok).toBe(true);
    const future = validateLogInput({ ...base, finishedAt: "2026-11-06" }, TODAY);
    expect(future).toEqual({ ok: false, error: "The watched date can't be in the future." });
    expect(validateLogInput({ ...base, finishedAt: "2026-02-30" }, TODAY).ok).toBe(false);
  });

  it("drops the date and rewatch flag unless the movie was watched", () => {
    const result = validateLogInput({ ...base, status: "dropped", rewatch: true }, TODAY);
    expect(result.ok && result.value).toMatchObject({ finished_at: null, rewatch: false, rating: 4.5 });
  });

  it("allows a watched movie without a date", () => {
    const result = validateLogInput({ ...base, finishedAt: null }, TODAY);
    expect(result.ok && result.value.finished_at).toBeNull();
  });
});

describe("mediaItemFields", () => {
  it("turns a search result into media_items columns", () => {
    expect(mediaItemFields(movie)).toEqual({
      type: "movie",
      source: "tmdb",
      source_id: "157336",
      title: "Interstellar",
      year: 2014,
      cover_url: "https://image.tmdb.org/t/p/w342/poster.jpg",
      creators: [],
      total_units: null,
    });
  });
});
