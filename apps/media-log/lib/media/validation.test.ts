import { describe, expect, it } from "vitest";
import type { LogWithMedia, MediaResult, NewLogInput } from "./types";
import {
  isValidDate,
  localToday,
  mediaItemFields,
  mediaItemToResult,
  planLogUpdate,
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
        progress: null, // a movie has no progress (Stage 4)
        progress_unit: null,
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
    expect(future).toEqual({ ok: false, error: "The finished date can't be in the future." });
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

describe("mediaItemToResult", () => {
  it("turns a cached item back into a search result (round trip)", () => {
    const item = { id: "item-1", ...mediaItemFields(movie), cached_at: "2026-11-05T12:00:00.000Z" };
    expect(mediaItemToResult(item)).toEqual({ ...movie, overview: null });
  });
});

// Stage 4: progress in the "log this" form.
const anime: MediaResult = { ...movie, type: "anime", source: "anilist", sourceId: "16498", totalUnits: 25 };

describe("validateLogInput with progress", () => {
  it("has no progress by default (older callers don't send it)", () => {
    const result = validateLogInput(base, TODAY);
    expect(result.ok && [result.value.progress, result.value.progress_unit]).toEqual([null, null]);
  });

  it("saves episode 7 for an anime you're watching", () => {
    const result = validateLogInput({ ...base, media: anime, status: "in_progress", progress: 7 }, TODAY);
    expect(result.ok && result.value).toMatchObject({ status: "in_progress", progress: 7, progress_unit: "episode" });
  });

  it("refuses progress on something you haven't started", () => {
    const result = validateLogInput({ ...base, media: anime, status: "planned", rating: null, progress: 3 }, TODAY);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("haven't started") });
  });

  it("passes on progress errors (past the last episode, movies)", () => {
    expect(validateLogInput({ ...base, media: anime, status: "in_progress", progress: 26 }, TODAY).ok).toBe(false);
    expect(validateLogInput({ ...base, status: "in_progress", progress: 1 }, TODAY).ok).toBe(false);
  });
});

// A log as the stores return it; `extra` changes the parts a test is about.
function animeLog(extra: Partial<LogWithMedia> = {}): LogWithMedia {
  return {
    id: "log-1",
    user_id: "user-1",
    media_item_id: "item-1",
    status: "in_progress",
    rating: null,
    progress: 7,
    progress_unit: "episode",
    review_text: null,
    started_at: null,
    finished_at: null,
    rewatch: false,
    created_at: "2026-11-01T12:00:00.000Z",
    media: { id: "item-1", ...mediaItemFields(anime), cached_at: "2026-11-01T12:00:00.000Z" },
    ...extra,
  };
}

describe("planLogUpdate (the progress tracker)", () => {
  it("saves a new episode count", () => {
    const result = planLogUpdate(animeLog(), { status: "in_progress", progress: 8, progressUnit: "episode" }, TODAY);
    expect(result).toEqual({
      ok: true,
      value: { status: "in_progress", progress: 8, progress_unit: "episode", finished_at: null, rewatch: false },
    });
  });

  it("marks it finished today when you reach the last episode", () => {
    const result = planLogUpdate(animeLog(), { status: "in_progress", progress: 25, progressUnit: "episode" }, TODAY);
    expect(result.ok && result.value).toMatchObject({ status: "completed", progress: 25, finished_at: TODAY });
  });

  it("moves 'Want to watch' to 'Watching' when you add progress", () => {
    const log = animeLog({ status: "planned", progress: null, progress_unit: null });
    const result = planLogUpdate(log, { status: "planned", progress: 1, progressUnit: null }, TODAY);
    expect(result.ok && result.value).toMatchObject({ status: "in_progress", progress: 1, progress_unit: "episode" });
  });

  it("goes straight from 'Want to watch' to finished if you enter the last episode", () => {
    const log = animeLog({ status: "planned", progress: null, progress_unit: null });
    const result = planLogUpdate(log, { status: "planned", progress: 25, progressUnit: "episode" }, TODAY);
    expect(result.ok && result.value.status).toBe("completed");
  });

  it("leaves Dropped and Paused alone, even at the end", () => {
    const result = planLogUpdate(animeLog(), { status: "dropped", progress: 25, progressUnit: "episode" }, TODAY);
    expect(result.ok && result.value.status).toBe("dropped");
  });

  it("clears progress when you go back to 'Want to watch'", () => {
    const result = planLogUpdate(animeLog(), { status: "planned", progress: 0, progressUnit: "episode" }, TODAY);
    expect(result.ok && result.value).toMatchObject({ status: "planned", progress: null, progress_unit: null });
  });

  it("refuses 'Want to watch' on a rated log (same rule as the form)", () => {
    const log = animeLog({ rating: 4 });
    const result = planLogUpdate(log, { status: "planned", progress: null, progressUnit: null }, TODAY);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("can't rate") });
  });

  it("keeps the finished date you entered, and clears it if you start again", () => {
    const done = animeLog({ status: "completed", progress: 25, finished_at: "2026-10-01", rewatch: true });
    const stillDone = planLogUpdate(done, { status: "completed", progress: 25, progressUnit: "episode" }, TODAY);
    expect(stillDone.ok && stillDone.value).toMatchObject({ finished_at: "2026-10-01", rewatch: true });

    const again = planLogUpdate(done, { status: "in_progress", progress: 3, progressUnit: "episode" }, TODAY);
    expect(again.ok && again.value).toMatchObject({ status: "in_progress", finished_at: null, rewatch: false });
  });

  // Found while clicking through the app: the tracker's box is pre-filled with
  // the saved progress, so "the progress is there" doesn't mean "you just added it".
  it("refuses 'Want to play' on a rated game, even with its hours still in the box", () => {
    const finishedGame = animeLog({
      status: "completed",
      rating: 4.5,
      progress: 60.5,
      progress_unit: "hour",
      finished_at: "2026-09-14",
      media: { ...animeLog().media, type: "game", source: "igdb", total_units: null },
    });
    const result = planLogUpdate(finishedGame, { status: "planned", progress: 60.5, progressUnit: "hour" }, TODAY);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("can't rate") });
  });

  it("lets you go back to 'Watching' at 25/25 (a rewatch) without finishing it again", () => {
    const done = animeLog({ status: "completed", progress: 25, finished_at: "2026-10-01" });
    const result = planLogUpdate(done, { status: "in_progress", progress: 25, progressUnit: "episode" }, TODAY);
    expect(result.ok && result.value).toMatchObject({ status: "in_progress", progress: 25, finished_at: null });
  });

  it("refuses bad progress and unknown statuses", () => {
    expect(planLogUpdate(animeLog(), { status: "in_progress", progress: 26, progressUnit: "episode" }, TODAY).ok).toBe(false);
    // @ts-expect-error: testing a value TypeScript would normally stop
    expect(planLogUpdate(animeLog(), { status: "binged", progress: 1, progressUnit: "episode" }, TODAY).ok).toBe(false);
  });

  it("tracks game hours and never auto-finishes on hours", () => {
    const game = animeLog({
      progress: null,
      progress_unit: null,
      media: { ...animeLog().media, type: "game", source: "igdb", total_units: null },
    });
    const result = planLogUpdate(game, { status: "in_progress", progress: 120, progressUnit: "hour" }, TODAY);
    expect(result.ok && result.value).toMatchObject({ status: "in_progress", progress: 120, progress_unit: "hour" });
  });
});
