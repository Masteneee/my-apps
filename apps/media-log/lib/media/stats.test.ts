import { describe, expect, it } from "vitest";
import { barPercent, maxCount, ratingDistribution, recapYears, topTags, yearlyRecap } from "./stats";
import type { LogStatus, LogWithMedia, MediaType } from "./types";

// Times are at noon UTC on purpose (same calendar day in every time zone from
// UTC-11 to UTC+11), like diary.test.ts. Most logs below use finished_at, which
// is a plain day and never moves.
type LogOptions = {
  item: string;
  type?: MediaType;
  rating?: number | null;
  status?: LogStatus;
  genres?: string[];
  day?: string; // "YYYY-MM-DD", the finished day (diary day)
};

let count = 0;
function log({
  item,
  type = "movie",
  rating = null,
  status = "completed",
  genres = [],
  day = "2026-03-10",
}: LogOptions): LogWithMedia {
  count += 1;
  return {
    id: `log-${count}`,
    user_id: "me",
    media_item_id: `item-${item}`,
    status,
    rating,
    progress: null,
    progress_unit: null,
    review_text: null,
    started_at: null,
    finished_at: status === "completed" ? day : null,
    rewatch: false,
    created_at: `${day}T12:00:00.000Z`,
    media: {
      id: `item-${item}`,
      type,
      source: "tmdb",
      source_id: item,
      title: item,
      year: null,
      cover_url: null,
      creators: [],
      total_units: null,
      genres,
      cached_at: `${day}T12:00:00.000Z`,
    },
  };
}

describe("ratingDistribution", () => {
  it("counts each item once (its latest log) per half-star", () => {
    const result = ratingDistribution([
      log({ item: "a", rating: 5 }),
      log({ item: "b", rating: 4.5 }),
      log({ item: "c", rating: 5 }),
      log({ item: "a", rating: 1 }), // older log of "a": ignored
      log({ item: "d", rating: null }), // not rated
    ]);
    expect(result.buckets).toHaveLength(10);
    expect(result.buckets[0]).toEqual({ rating: 0.5, count: 0 });
    expect(result.buckets.find((b) => b.rating === 5)?.count).toBe(2);
    expect(result.buckets.find((b) => b.rating === 4.5)?.count).toBe(1);
    expect(result.buckets.find((b) => b.rating === 1)?.count).toBe(0);
    expect(result.rated).toBe(3);
    expect(result.average).toBeCloseTo(14.5 / 3);
  });

  it("has no average without ratings", () => {
    expect(ratingDistribution([log({ item: "a" })])).toMatchObject({ rated: 0, average: null });
  });
});

describe("maxCount and barPercent", () => {
  it("scales bars to the biggest one", () => {
    expect(maxCount([{ count: 1 }, { count: 4 }])).toBe(4);
    expect(maxCount([])).toBe(1); // never divide by 0
    expect(barPercent(3, 4)).toBe(75);
    expect(barPercent(4, 4)).toBe(100);
    expect(barPercent(0, 4)).toBe(0);
    expect(barPercent(1, 1000)).toBe(2); // a tiny count still shows
  });
});

describe("topTags", () => {
  it("counts shared tags across media, each item once, skipping 'planned'", () => {
    const tags = topTags([
      log({ item: "interstellar", genres: ["Science Fiction", "Drama"] }),
      log({ item: "planetes", type: "manga", genres: ["Sci-Fi", "Space", "Drama"] }),
      log({ item: "outer-wilds", type: "game", genres: ["science fiction", "Mystery"] }),
      log({ item: "interstellar", genres: ["Science Fiction", "Drama"] }), // a rewatch: same item
      log({ item: "dune", type: "book", status: "planned", genres: ["Science fiction"] }), // not seen yet
    ]);
    expect(tags).toEqual([
      { tag: "sci-fi", count: 3 },
      { tag: "drama", count: 2 },
      // Ties keep the shared tag order (most specific first).
      { tag: "space", count: 1 },
      { tag: "mystery", count: 1 },
    ]);
  });

  it("can be cut, and is empty without genres", () => {
    expect(topTags([log({ item: "a", genres: ["Drama", "Comedy"] })], 1)).toEqual([{ tag: "comedy", count: 1 }]);
    expect(topTags([log({ item: "a" })])).toEqual([]);
  });
});

describe("recapYears", () => {
  it("lists the years with diary entries, newest first", () => {
    expect(
      recapYears([
        log({ item: "a", day: "2025-02-01" }),
        log({ item: "b", day: "2026-01-01" }),
        log({ item: "c", day: "2025-12-31" }),
      ]),
    ).toEqual([2026, 2025]);
    expect(recapYears([])).toEqual([]);
  });
});

describe("yearlyRecap", () => {
  // Newest first, like getLogsForUser.
  const logs = [
    log({ item: "frieren", type: "anime", rating: 5, day: "2026-10-02", genres: ["Fantasy", "Adventure"] }),
    log({ item: "berserk", type: "manga", status: "in_progress", day: "2026-10-01", genres: ["Fantasy", "Horror"] }),
    log({ item: "hades", type: "game", rating: 4, day: "2026-03-20", genres: ["Action", "Fantasy"] }),
    log({ item: "arrival", rating: 4.5, day: "2026-03-15", genres: ["Science Fiction"] }),
    log({ item: "interstellar", rating: 5, day: "2026-03-01", genres: ["Science Fiction"] }),
    log({ item: "dune", type: "book", status: "planned", day: "2026-01-05", genres: ["Science fiction"] }),
    log({ item: "inception", rating: 5, day: "2025-12-31" }), // another year
  ];

  it("sums up one year", () => {
    const recap = yearlyRecap(logs, 2026);
    expect(recap.entries).toBe(6);
    expect(recap.finished).toBe(4);
    expect(recap.finishedByType).toEqual({ movie: 2, series: 0, anime: 1, manga: 0, book: 0, game: 1 });
    expect(recap.rated).toBe(4);
    expect(recap.averageRating).toBeCloseTo(18.5 / 4);
    // 5★ ties: the more recent (Frieren, October) first.
    expect(recap.topRated.map((l) => l.media.title)).toEqual(["frieren", "interstellar", "arrival"]);
    expect(recap.topTag).toEqual({ tag: "fantasy", count: 3 });
    expect(recap.busiestMonth).toEqual({ label: "March 2026", count: 3 });
  });

  it("is empty for a year without entries", () => {
    const recap = yearlyRecap(logs, 2020);
    expect(recap).toMatchObject({
      entries: 0,
      finished: 0,
      rated: 0,
      averageRating: null,
      topTag: null,
      busiestMonth: null,
    });
    expect(recap.topRated).toEqual([]);
  });

  it("picks the earlier month when two months tie", () => {
    const recap = yearlyRecap([log({ item: "a", day: "2026-05-01" }), log({ item: "b", day: "2026-02-01" })], 2026);
    expect(recap.busiestMonth).toEqual({ label: "February 2026", count: 1 });
  });
});
