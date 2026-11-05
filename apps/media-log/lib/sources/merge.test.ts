import { describe, expect, it } from "vitest";
import type { MediaResult } from "../media/types";
import { combine, dedupe, interleaveByType, isSameItem, matchScore, mergeResults, rankByTitleMatch } from "./merge";

// A tiny factory: a result with sensible defaults, each test changes what matters.
function r(partial: Partial<MediaResult> & Pick<MediaResult, "type" | "title">): MediaResult {
  return {
    source: "tmdb",
    sourceId: partial.title,
    originalTitle: null,
    year: 2000,
    coverUrl: null,
    creators: [],
    totalUnits: null,
    overview: null,
    ...partial,
  };
}

const spiritedMovie = r({ type: "movie", title: "Spirited Away", originalTitle: "千と千尋の神隠し", year: 2001, sourceId: "129", coverUrl: "https://tmdb/poster.jpg", overview: "TMDB text" });
const spiritedAnime = r({ type: "anime", source: "anilist", title: "Spirited Away", originalTitle: "千と千尋の神隠し", year: 2001, sourceId: "199", creators: ["Studio Ghibli"], totalUnits: 1 });

describe("isSameItem", () => {
  it("same source, type and id is the same item", () => {
    expect(isSameItem(spiritedMovie, { ...spiritedMovie, title: "Renamed" })).toBe(true);
  });

  it("an anime film and the TMDB movie with the same title and year are the same", () => {
    expect(isSameItem(spiritedMovie, spiritedAnime)).toBe(true);
    // Matching on the ORIGINAL title also works (different English titles).
    expect(isSameItem({ ...spiritedMovie, title: "Sen to Chihiro" }, spiritedAnime)).toBe(true);
  });

  it("ignores case, accents and punctuation in titles", () => {
    const a = r({ type: "movie", title: "Your Name.", year: 2016 });
    const b = r({ type: "anime", source: "anilist", title: "your name", year: 2016 });
    expect(isSameItem(a, b)).toBe(true);
  });

  it("different years are different items (remakes)", () => {
    expect(isSameItem(r({ type: "movie", title: "Dune", year: 1984, sourceId: "841" }), r({ type: "movie", title: "Dune", year: 2021, sourceId: "438631" }))).toBe(false);
  });

  it("a manga and its anime are NOT the same item, nor a book and a movie", () => {
    const manga = r({ type: "manga", source: "anilist", title: "Attack on Titan", year: 2013, sourceId: "53390" });
    const anime = r({ type: "anime", source: "anilist", title: "Attack on Titan", year: 2013, sourceId: "16498" });
    expect(isSameItem(manga, anime)).toBe(false);
    expect(isSameItem(r({ type: "book", title: "Dune", year: 2021 }), r({ type: "movie", title: "Dune", year: 2021 }))).toBe(false);
  });

  it("with a missing year, the same type and a shared creator is enough", () => {
    const withYear = r({ type: "book", source: "openlibrary", title: "Dune", year: 1965, sourceId: "OL1W", creators: ["Frank Herbert"] });
    const noYear = r({ type: "book", source: "openlibrary", title: "Dune", year: null, sourceId: "OL2W", creators: ["frank herbert"] });
    const otherAuthor = { ...noYear, sourceId: "OL3W", creators: ["Someone Else"] };
    expect(isSameItem(withYear, noYear)).toBe(true);
    expect(isSameItem(withYear, otherAuthor)).toBe(false);
    // No creators at all: we can't tell, so we keep both.
    expect(isSameItem({ ...withYear, creators: [] }, { ...noYear, creators: [] })).toBe(false);
  });

  it("different titles are different items", () => {
    expect(isSameItem(r({ type: "movie", title: "Dune" }), r({ type: "movie", title: "Dune: Part Two" }))).toBe(false);
  });
});

describe("combine", () => {
  it("keeps the anime version and fills its blanks from the TMDB copy", () => {
    expect(combine(spiritedMovie, spiritedAnime)).toEqual({
      ...spiritedAnime,
      coverUrl: "https://tmdb/poster.jpg", // borrowed
      overview: "TMDB text", // borrowed
    });
    // Same result whichever comes first.
    expect(combine(spiritedAnime, spiritedMovie)).toEqual(combine(spiritedMovie, spiritedAnime));
  });

  it("keeps the first one when the types are the same", () => {
    const a = r({ type: "book", source: "openlibrary", title: "Dune", sourceId: "A", totalUnits: null });
    const b = r({ type: "book", source: "openlibrary", title: "Dune", sourceId: "B", totalUnits: 604 });
    expect(combine(a, b)).toMatchObject({ sourceId: "A", totalUnits: 604 });
  });

  it("never borrows a count from another type", () => {
    const series = r({ type: "series", title: "Attack on Titan", totalUnits: 87 });
    const anime = r({ type: "anime", source: "anilist", title: "Attack on Titan", totalUnits: null });
    expect(combine(series, anime).totalUnits).toBeNull();
  });
});

describe("dedupe", () => {
  it("keeps one result per real item, where the first copy was", () => {
    const parasite = r({ type: "movie", title: "Parasite", year: 2019 });
    const results = dedupe([spiritedMovie, parasite, spiritedAnime, { ...parasite }]);
    expect(results.map((x) => `${x.type}:${x.title}`)).toEqual(["anime:Spirited Away", "movie:Parasite"]);
  });

  it("leaves a list without duplicates alone", () => {
    const list = [r({ type: "movie", title: "A" }), r({ type: "game", title: "B" })];
    expect(dedupe(list)).toEqual(list);
  });
});

describe("interleaveByType", () => {
  it("deals one of each type in turn, keeping each source's order", () => {
    const list = [
      r({ type: "movie", title: "m1" }),
      r({ type: "movie", title: "m2" }),
      r({ type: "movie", title: "m3" }),
      r({ type: "game", title: "g1" }),
      r({ type: "book", title: "b1" }),
      r({ type: "game", title: "g2" }),
    ];
    // Type order follows MEDIA_TYPES: movie, series, anime, manga, book, game.
    expect(interleaveByType(list).map((x) => x.title)).toEqual(["m1", "b1", "g1", "m2", "g2", "m3"]);
  });

  it("handles an empty list", () => {
    expect(interleaveByType([])).toEqual([]);
  });
});

describe("matchScore and rankByTitleMatch", () => {
  it("scores exact > starts with > whole word > other", () => {
    expect(matchScore("dune", r({ type: "movie", title: "Dune" }))).toBe(3);
    expect(matchScore("dune", r({ type: "movie", title: "Dune: Part Two" }))).toBe(2);
    expect(matchScore("dune", r({ type: "book", title: "Children of Dune" }))).toBe(1);
    expect(matchScore("dune", r({ type: "book", title: "Dunes of Mars" }))).toBe(0); // "dune" isn't a whole word here
    expect(matchScore("frank herbert", r({ type: "book", title: "Dune Messiah" }))).toBe(0);
    expect(matchScore("君の名は", r({ type: "movie", title: "Your Name.", originalTitle: "君の名は。" }))).toBe(3);
  });

  it("sorts best matches first and keeps the order of ties", () => {
    const list = [
      r({ type: "game", title: "Dune: Spice Wars" }),
      r({ type: "book", title: "Dune Messiah" }),
      r({ type: "movie", title: "Dune" }),
      r({ type: "book", title: "Dune" }),
    ];
    expect(rankByTitleMatch(list, "dune").map((x) => `${x.type}:${x.title}`)).toEqual([
      "movie:Dune",
      "book:Dune",
      "game:Dune: Spice Wars",
      "book:Dune Messiah",
    ]);
    expect(list[0].title).toBe("Dune: Spice Wars"); // the original list is not changed
  });
});

describe("mergeResults", () => {
  it("interleaves, removes duplicates, then ranks", () => {
    const merged = mergeResults(
      [
        r({ type: "movie", title: "Spirited Away", year: 2001, sourceId: "129" }),
        r({ type: "movie", title: "Spirited Away 2: Not Real", year: 2030, sourceId: "999" }),
        r({ type: "anime", source: "anilist", title: "Spirited Away", year: 2001, sourceId: "199", totalUnits: 1 }),
        r({ type: "game", source: "igdb", title: "Away", year: 2021, sourceId: "g1" }),
      ],
      "spirited away",
    );
    expect(merged.map((x) => `${x.source}:${x.sourceId}`)).toEqual(["anilist:199", "tmdb:999", "igdb:g1"]);
  });
});
