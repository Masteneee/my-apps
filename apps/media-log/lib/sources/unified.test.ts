import { describe, expect, it, vi } from "vitest";
import type { MediaResult, MediaSource, MediaType } from "../media/types";
import type { SourceAdapter } from "./types";
import { parseSearchFilter, typesForFilter } from "./types";
import { perTypeLimit, unifiedSearch, type SourceEntry } from "./unified";
import { createSourceEntries } from "./setup";

// A fake adapter: answers with fixed results, or throws, and records its calls.
function fakeAdapter(
  source: MediaSource,
  types: MediaType[],
  answer: MediaResult[] | Error,
  mode: "live" | "sample" = "live",
): SourceAdapter & { search: ReturnType<typeof vi.fn> } {
  return {
    source,
    label: source.toUpperCase(),
    types,
    mode,
    search: vi.fn(async () => {
      if (answer instanceof Error) throw answer;
      return answer;
    }),
  };
}

function result(source: MediaSource, type: MediaType, title: string, year = 2001): MediaResult {
  return { type, source, sourceId: `${source}-${title}`, title, originalTitle: null, year, coverUrl: null, creators: [], totalUnits: null, overview: null };
}

const quiet = () => {}; // instead of console.warn, so test output stays clean

describe("filters", () => {
  it("reads the type filter from the URL, defaulting to all", () => {
    expect(parseSearchFilter("anime")).toBe("anime");
    expect(parseSearchFilter("all")).toBe("all");
    expect(parseSearchFilter("podcast")).toBe("all");
    expect(parseSearchFilter(null)).toBe("all");
  });

  it("turns a filter into media types, and picks a limit", () => {
    expect(typesForFilter("book")).toEqual(["book"]);
    expect(typesForFilter("all")).toHaveLength(6);
    expect(perTypeLimit(["book"])).toBe(20);
    expect(perTypeLimit(typesForFilter("all"))).toBe(8);
  });
});

describe("unifiedSearch", () => {
  it("asks every source in parallel and merges + dedupes their answers", async () => {
    const tmdb = fakeAdapter("tmdb", ["movie", "series"], [result("tmdb", "movie", "Spirited Away")]);
    const anilist = fakeAdapter("anilist", ["anime", "manga"], [result("anilist", "anime", "Spirited Away")]);
    const igdb = fakeAdapter("igdb", ["game"], [result("igdb", "game", "Spirited Quest")]);
    const entries: SourceEntry[] = [tmdb, anilist, igdb].map((adapter) => ({ adapter, fallback: null, sampleReason: null }));

    const answer = await unifiedSearch(" spirited away ", "all", entries, quiet);
    expect(answer.query).toBe("spirited away");
    expect(answer.results.map((r) => `${r.source}:${r.type}`)).toEqual(["anilist:anime", "igdb:game"]);
    expect(answer.sources.map((s) => s.state)).toEqual(["live", "live", "live"]);
    // Each adapter only gets the types it covers, and the "all" limit.
    expect(tmdb.search).toHaveBeenCalledWith("spirited away", { types: ["movie", "series"], limit: 8 });
  });

  it("skips sources that can't find the filtered type", async () => {
    const tmdb = fakeAdapter("tmdb", ["movie", "series"], []);
    const igdb = fakeAdapter("igdb", ["game"], [result("igdb", "game", "Hades")]);
    const answer = await unifiedSearch("hades", "game", [tmdb, igdb].map((adapter) => ({ adapter, fallback: null, sampleReason: null })), quiet);
    expect(tmdb.search).not.toHaveBeenCalled();
    expect(igdb.search).toHaveBeenCalledWith("hades", { types: ["game"], limit: 20 });
    expect(answer.sources.map((s) => s.source)).toEqual(["igdb"]);
  });

  it("a failing source with a fallback uses its saved samples, and says why", async () => {
    const warn = vi.fn();
    const live = fakeAdapter("anilist", ["anime", "manga"], new Error("Couldn't reach AniList."));
    const sample = fakeAdapter("anilist", ["anime", "manga"], [result("anilist", "anime", "Planetes", 2003)], "sample");
    const answer = await unifiedSearch("planetes", "all", [{ adapter: live, fallback: sample, sampleReason: null }], warn);

    expect(answer.results.map((r) => r.title)).toEqual(["Planetes"]);
    expect(answer.sources[0]).toMatchObject({ state: "sample", sampleReason: "live-failed", error: "Couldn't reach AniList." });
    expect(warn).toHaveBeenCalledOnce();
  });

  it("a failing source without a fallback reports its error, and the others still answer", async () => {
    const broken = fakeAdapter("tmdb", ["movie", "series"], new Error("TMDB refused the key."));
    const books = fakeAdapter("openlibrary", ["book"], [result("openlibrary", "book", "Dune", 1965)]);
    const answer = await unifiedSearch(
      "dune",
      "all",
      [
        { adapter: broken, fallback: null, sampleReason: null },
        { adapter: books, fallback: null, sampleReason: null },
      ],
      quiet,
    );
    expect(answer.results.map((r) => r.title)).toEqual(["Dune"]);
    expect(answer.sources[0]).toEqual({
      source: "tmdb",
      label: "TMDB",
      types: ["movie", "series"],
      state: "error",
      error: "TMDB refused the key.",
    });
  });

  it("an empty search calls nobody and just reports how each source is set up", async () => {
    const tmdb = fakeAdapter("tmdb", ["movie", "series"], [], "sample");
    const books = fakeAdapter("openlibrary", ["book"], []);
    const answer = await unifiedSearch(
      "  ",
      "all",
      [
        { adapter: tmdb, fallback: null, sampleReason: "no-key" },
        { adapter: books, fallback: null, sampleReason: null },
      ],
      quiet,
    );
    expect(answer.results).toEqual([]);
    expect(tmdb.search).not.toHaveBeenCalled();
    expect(answer.sources.map((s) => [s.state, s.sampleReason])).toEqual([
      ["sample", "no-key"],
      ["live", undefined],
    ]);
  });
});

describe("unifiedSearch with the real adapters' saved samples", () => {
  // MEDIA_LOG_USE_SAMPLES=1: every source answers from its saved sample, no network.
  const entries = createSourceEntries({ MEDIA_LOG_USE_SAMPLES: "1" });

  it("finds one title across movies, books and games", async () => {
    const answer = await unifiedSearch("dune", "all", entries, quiet);
    const found = answer.results.map((r) => `${r.type}:${r.title}${r.year ? ` (${r.year})` : ""}`);
    // Exact title matches first, one per type, then the rest.
    expect(found.slice(0, 2)).toEqual(["movie:Dune (2021)", "book:Dune (1965)"]);
    expect(found).toContain("game:Dune: Spice Wars (2022)");
    // Open Library has two "Dune" entries by Frank Herbert (one without a year): shown once.
    expect(found.filter((f) => f.startsWith("book:Dune ("))).toHaveLength(1);
    expect(answer.sources.every((s) => s.state === "sample" && s.sampleReason === "forced")).toBe(true);
  });

  it("shows an anime once even when TMDB also has it", async () => {
    const answer = await unifiedSearch("attack on titan", "all", entries, quiet);
    expect(answer.results.map((r) => `${r.source}:${r.type}`)).toEqual(["anilist:anime", "anilist:manga"]);
    // The anime kept AniList's details.
    expect(answer.results[0]).toMatchObject({ totalUnits: 25, creators: ["Wit Studio"] });
  });

  it("filters by type", async () => {
    const answer = await unifiedSearch("attack on titan", "series", entries, quiet);
    expect(answer.results.map((r) => `${r.source}:${r.type}`)).toEqual(["tmdb:series"]);
    expect(answer.sources.map((s) => s.source)).toEqual(["tmdb"]);
  });
});
