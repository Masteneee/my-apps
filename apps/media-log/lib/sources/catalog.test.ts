import { describe, expect, it } from "vitest";
import { genresToTags } from "../media/tags";
import { sampleCatalog } from "./catalog";

describe("sampleCatalog", () => {
  const catalog = sampleCatalog();

  it("has every media type", () => {
    const types = new Set(catalog.map((result) => result.type));
    expect([...types].sort()).toEqual(["anime", "book", "game", "manga", "movie", "series"]);
  });

  it("merges duplicates like search does", () => {
    // TMDB's Spirited Away movie and AniList's anime are one item: the anime.
    const spirited = catalog.filter((result) => result.title === "Spirited Away");
    expect(spirited.map((r) => r.type)).toEqual(["anime"]);
    // The two Open Library "Dune" entries by Frank Herbert are one book.
    expect(catalog.filter((r) => r.type === "book" && r.title === "Dune")).toHaveLength(1);
    // Keys are unique.
    const keys = catalog.map((r) => `${r.type}:${r.source}:${r.sourceId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives almost every entry at least one shared tag", () => {
    // TMDB's "The Last of Us" series is only "Drama", still one tag.
    const untagged = catalog.filter((result) => genresToTags(result.genres).length === 0);
    expect(untagged.map((r) => r.title)).toEqual([]);
  });

  it("matches Sci-Fi across four sources", () => {
    const sciFi = (title: string, type: string) =>
      genresToTags(catalog.find((r) => r.title === title && r.type === type)!.genres).includes("sci-fi");
    expect(sciFi("Interstellar", "movie")).toBe(true); // TMDB "Science Fiction"
    expect(sciFi("Planetes", "manga")).toBe(true); // AniList "Sci-Fi"
    expect(sciFi("Project Hail Mary", "book")).toBe(true); // Open Library "Science fiction"
    expect(sciFi("Outer Wilds", "game")).toBe(true); // IGDB "Science fiction"
  });

  it("is worked out once", () => {
    expect(sampleCatalog()).toBe(catalog);
  });
});
