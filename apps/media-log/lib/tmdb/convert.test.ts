import { describe, expect, it } from "vitest";
import { convertTmdbSearchResponse, posterUrl, tmdbMovieToMediaResult, yearFromDate } from "./convert";
import sample from "./sample-search-response.json";
import type { TmdbMovie, TmdbSearchResponse } from "./types";

// All tests use the SAVED sample answer: no internet, same result every time.
const sampleResponse = sample as TmdbSearchResponse;
const interstellar = sampleResponse.results.find((m) => m.id === 157336)!;
const spiritedAway = sampleResponse.results.find((m) => m.id === 129)!;

describe("tmdbMovieToMediaResult", () => {
  it("converts a TMDB movie into our MediaResult shape", () => {
    expect(tmdbMovieToMediaResult(interstellar)).toEqual({
      type: "movie",
      source: "tmdb",
      sourceId: "157336",
      title: "Interstellar",
      originalTitle: null, // same as the title, so not repeated
      year: 2014,
      coverUrl: "https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
      creators: [],
      totalUnits: null,
      overview: interstellar.overview,
    });
  });

  it("keeps the original title when it differs", () => {
    const result = tmdbMovieToMediaResult(spiritedAway);
    expect(result.title).toBe("Spirited Away");
    expect(result.originalTitle).toBe("千と千尋の神隠し");
  });

  it("handles a movie with no poster, no date and no overview", () => {
    const unknown: TmdbMovie = {
      ...interstellar,
      id: 1,
      title: "Mystery Film",
      original_title: "Mystery Film",
      poster_path: null,
      release_date: "",
      overview: "   ",
    };
    const result = tmdbMovieToMediaResult(unknown);
    expect(result.coverUrl).toBeNull();
    expect(result.year).toBeNull();
    expect(result.overview).toBeNull();
  });

  it("falls back to the original title when the title is empty", () => {
    const result = tmdbMovieToMediaResult({ ...spiritedAway, title: "" });
    expect(result.title).toBe("千と千尋の神隠し");
    expect(result.originalTitle).toBeNull();
  });
});

describe("convertTmdbSearchResponse", () => {
  it("converts every movie in the saved sample", () => {
    const results = convertTmdbSearchResponse(sampleResponse);
    expect(results).toHaveLength(sampleResponse.results.length);
    expect(results.every((r) => r.type === "movie" && r.source === "tmdb")).toBe(true);
    // Ids are unique, so the sample can't produce duplicate keys in the UI.
    expect(new Set(results.map((r) => r.sourceId)).size).toBe(results.length);
  });

  it("skips adult films and broken entries", () => {
    const results = convertTmdbSearchResponse({
      results: [interstellar, { ...interstellar, id: 2, adult: true }, { title: "no id" }, null, "junk"],
    });
    expect(results.map((r) => r.sourceId)).toEqual(["157336"]);
  });

  it("returns an empty list for answers that aren't search results", () => {
    expect(convertTmdbSearchResponse(null)).toEqual([]);
    expect(convertTmdbSearchResponse("oops")).toEqual([]);
    expect(convertTmdbSearchResponse({ status_message: "Invalid API key" })).toEqual([]);
  });
});

describe("small helpers", () => {
  it("builds poster addresses", () => {
    expect(posterUrl("/abc.jpg")).toBe("https://image.tmdb.org/t/p/w342/abc.jpg");
    expect(posterUrl("/abc.jpg", "w185")).toBe("https://image.tmdb.org/t/p/w185/abc.jpg");
    expect(posterUrl(null)).toBeNull();
    expect(posterUrl("")).toBeNull();
  });

  it("reads the year from a TMDB date", () => {
    expect(yearFromDate("1994-09-23")).toBe(1994);
    expect(yearFromDate("")).toBeNull();
    expect(yearFromDate(undefined)).toBeNull();
    expect(yearFromDate("soon")).toBeNull();
  });
});
