import { describe, expect, it } from "vitest";
import { countByType, latestLogPerItem, ratingToStars } from "./display";
import { friendlyMediaError } from "./supabase";
import type { LogWithMedia, MediaType } from "./types";

// A tiny factory: only the fields these helpers look at matter.
function log(id: string, mediaId: string, type: MediaType = "movie"): LogWithMedia {
  return {
    id,
    user_id: "user-1",
    media_item_id: mediaId,
    status: "completed",
    rating: null,
    progress: null,
    review_text: null,
    started_at: null,
    finished_at: null,
    rewatch: false,
    created_at: "2026-11-05T12:00:00.000Z",
    media: {
      id: mediaId,
      type,
      source: "tmdb",
      source_id: mediaId,
      title: mediaId,
      year: null,
      cover_url: null,
      creators: [],
      total_units: null,
      cached_at: "2026-11-05T12:00:00.000Z",
    },
  };
}

describe("ratingToStars", () => {
  it("draws full and half stars", () => {
    expect(ratingToStars(5)).toBe("★★★★★");
    expect(ratingToStars(3.5)).toBe("★★★½");
    expect(ratingToStars(0.5)).toBe("½");
    expect(ratingToStars(null)).toBe("");
  });
});

describe("latestLogPerItem", () => {
  it("keeps only the newest log of each item, in order", () => {
    // Newest first: a rewatch of Interstellar (log-3) is newer than the first watch (log-1).
    const logs = [log("log-3", "interstellar"), log("log-2", "parasite"), log("log-1", "interstellar")];
    expect(latestLogPerItem(logs).map((l) => l.id)).toEqual(["log-3", "log-2"]);
  });

  it("handles an empty diary", () => {
    expect(latestLogPerItem([])).toEqual([]);
  });
});

describe("countByType", () => {
  it("counts different items per type, rewatches once, and every type starts at 0", () => {
    const logs = [log("a", "interstellar"), log("b", "interstellar"), log("c", "parasite"), log("d", "berserk", "manga")];
    expect(countByType(logs)).toEqual({ movie: 2, series: 0, anime: 0, manga: 1, book: 0, game: 0 });
  });
});

describe("friendlyMediaError", () => {
  it("explains database errors in plain words", () => {
    expect(friendlyMediaError({ code: "42501", message: "new row violates row-level security" })).toContain(
      "your own logs",
    );
    expect(friendlyMediaError({ code: "PGRST205", message: "Could not find the table" })).toContain("migration");
    expect(friendlyMediaError({ code: "something_new", message: "Original text" })).toBe("Original text");
  });
});
