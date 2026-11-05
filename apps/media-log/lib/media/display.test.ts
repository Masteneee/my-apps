import { describe, expect, it } from "vitest";
import {
  countByType,
  groupByType,
  latestLogPerItem,
  ratingToStars,
  statusLabel,
  TYPE_LABELS,
  unitsLabel,
  wordsFor,
} from "./display";
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

describe("groupByType", () => {
  it("makes one group per type, in the usual type order, skipping empty types", () => {
    const logs = [log("a", "berserk", "manga"), log("b", "interstellar"), log("c", "hades", "game"), log("d", "dune")];
    expect(groupByType(logs).map((g) => [g.type, g.logs.map((l) => l.id)])).toEqual([
      ["movie", ["b", "d"]],
      ["manga", ["a"]],
      ["game", ["c"]],
    ]);
    expect(groupByType([])).toEqual([]);
  });
});

describe("words per media type", () => {
  it("watches movies, reads books, plays games", () => {
    expect(statusLabel("completed", "movie")).toBe("Watched");
    expect(statusLabel("in_progress", "anime")).toBe("Watching");
    expect(statusLabel("planned", "book")).toBe("Want to read");
    expect(statusLabel("in_progress", "manga")).toBe("Reading");
    expect(statusLabel("completed", "game")).toBe("Finished");
    expect(wordsFor("game").again).toContain("replay");
  });

  it("has a name for every type", () => {
    expect(TYPE_LABELS.book).toEqual({ one: "Book", many: "Books" });
  });

  it("counts episodes, chapters and pages, but not for movies or games", () => {
    expect(unitsLabel("anime", 24)).toBe("24 episodes");
    expect(unitsLabel("anime", 1)).toBe("1 episode");
    expect(unitsLabel("manga", 139)).toBe("139 chapters");
    expect(unitsLabel("book", 412)).toBe("412 pages");
    expect(unitsLabel("series", null)).toBeNull();
    expect(unitsLabel("movie", 1)).toBeNull();
    expect(unitsLabel("game", 40)).toBeNull();
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
