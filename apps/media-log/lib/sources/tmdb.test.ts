import { describe, expect, it, vi } from "vitest";
import sampleMovieJson from "./samples/tmdb-search-movie.json";
import sampleTvJson from "./samples/tmdb-search-tv.json";
import {
  buildTmdbSearchRequest,
  convertTmdbMovieResponse,
  convertTmdbTvResponse,
  createTmdbSampleSource,
  createTmdbSource,
  pickTmdbCredentials,
  posterUrl,
  searchTmdbMovieSample,
  searchTmdbTvSample,
  tmdbGenreNames,
  tmdbMovieToMediaResult,
  tmdbTvToMediaResult,
  type TmdbMovie,
  type TmdbSearchResponse,
  type TmdbTvShow,
} from "./tmdb";

// All tests use the SAVED sample answers: no internet, same result every time.
const sampleMovies = sampleMovieJson as TmdbSearchResponse<TmdbMovie>;
const sampleTv = sampleTvJson as TmdbSearchResponse<TmdbTvShow>;
const interstellar = sampleMovies.results.find((m) => m.id === 157336)!;
const spiritedAway = sampleMovies.results.find((m) => m.id === 129)!;
const attackOnTitan = sampleTv.results.find((s) => s.id === 1429)!;

const BOTH = { types: ["movie", "series"] as const, limit: 20 };

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
      genres: ["Adventure", "Drama", "Science Fiction"], // from genre_ids [12, 18, 878]
    });
  });

  it("keeps the original title when it differs", () => {
    const result = tmdbMovieToMediaResult(spiritedAway);
    expect(result.title).toBe("Spirited Away");
    expect(result.originalTitle).toBe("千と千尋の神隠し");
  });

  it("handles a movie with no poster, no date and no overview", () => {
    const result = tmdbMovieToMediaResult({
      ...interstellar,
      id: 1,
      title: "Mystery Film",
      original_title: "Mystery Film",
      poster_path: null,
      release_date: "",
      overview: "   ",
    });
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

describe("tmdbTvToMediaResult", () => {
  it("converts a TMDB series (name, first_air_date) into a 'series' MediaResult", () => {
    expect(tmdbTvToMediaResult(attackOnTitan)).toEqual({
      type: "series",
      source: "tmdb",
      sourceId: "1429",
      title: "Attack on Titan",
      originalTitle: "進撃の巨人",
      year: 2013,
      coverUrl: "https://image.tmdb.org/t/p/w342/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg",
      creators: [],
      totalUnits: null,
      overview: attackOnTitan.overview,
      genres: ["Animation", "Action & Adventure", "Sci-Fi & Fantasy"],
    });
  });
});

describe("tmdbGenreNames (Stage 6)", () => {
  it("turns TMDB's genre numbers into names, skipping unknown ones", () => {
    expect(tmdbGenreNames([878, 18])).toEqual(["Science Fiction", "Drama"]);
    expect(tmdbGenreNames([10765, 123456])).toEqual(["Sci-Fi & Fantasy"]);
    expect(tmdbGenreNames(undefined)).toEqual([]);
    expect(tmdbGenreNames(["878"])).toEqual([]); // not a number
  });
});

describe("converting whole answers", () => {
  it("converts every movie and every series in the saved samples", () => {
    const movies = convertTmdbMovieResponse(sampleMovies);
    const series = convertTmdbTvResponse(sampleTv);
    expect(movies).toHaveLength(sampleMovies.results.length);
    expect(series).toHaveLength(sampleTv.results.length);
    expect(movies.every((r) => r.type === "movie" && r.source === "tmdb")).toBe(true);
    expect(series.every((r) => r.type === "series" && r.source === "tmdb")).toBe(true);
    // Ids are unique, so the samples can't produce duplicate keys in the UI.
    expect(new Set(movies.map((r) => r.sourceId)).size).toBe(movies.length);
    expect(new Set(series.map((r) => r.sourceId)).size).toBe(series.length);
  });

  it("skips adult entries and broken entries", () => {
    const movies = convertTmdbMovieResponse({
      results: [interstellar, { ...interstellar, id: 2, adult: true }, { title: "no id" }, null, "junk"],
    });
    expect(movies.map((r) => r.sourceId)).toEqual(["157336"]);
    const series = convertTmdbTvResponse({ results: [attackOnTitan, { ...attackOnTitan, id: 3, adult: true }, { id: 4 }] });
    expect(series.map((r) => r.sourceId)).toEqual(["1429"]);
  });

  it("returns an empty list for answers that aren't search results", () => {
    expect(convertTmdbMovieResponse(null)).toEqual([]);
    expect(convertTmdbMovieResponse("oops")).toEqual([]);
    expect(convertTmdbTvResponse({ status_message: "Invalid API key" })).toEqual([]);
  });

  it("builds poster addresses", () => {
    expect(posterUrl("/abc.jpg")).toBe("https://image.tmdb.org/t/p/w342/abc.jpg");
    expect(posterUrl("/abc.jpg", "w185")).toBe("https://image.tmdb.org/t/p/w185/abc.jpg");
    expect(posterUrl(null)).toBeNull();
    expect(posterUrl("")).toBeNull();
  });
});

describe("pickTmdbCredentials", () => {
  it("prefers the read access token, then the API key", () => {
    expect(pickTmdbCredentials({ TMDB_READ_ACCESS_TOKEN: "eyJtoken", TMDB_API_KEY: "abc" })).toEqual({
      kind: "token",
      value: "eyJtoken",
    });
    expect(pickTmdbCredentials({ TMDB_API_KEY: " abc " })).toEqual({ kind: "apiKey", value: "abc" });
  });

  it("returns null (= use the sample) when nothing is set", () => {
    expect(pickTmdbCredentials({})).toBeNull();
    expect(pickTmdbCredentials({ TMDB_READ_ACCESS_TOKEN: "  ", TMDB_API_KEY: "" })).toBeNull();
  });
});

describe("buildTmdbSearchRequest", () => {
  it("sends a token in the Authorization header, never in the URL", () => {
    const { url, headers } = buildTmdbSearchRequest("movie", "spirited away", { kind: "token", value: "eyJsecret" });
    expect(url).toBe(
      "https://api.themoviedb.org/3/search/movie?query=spirited+away&include_adult=false&language=en-US&page=1",
    );
    expect(headers.authorization).toBe("Bearer eyJsecret");
    expect(url).not.toContain("eyJsecret");
  });

  it("sends an API key as ?api_key=, and searches series at /search/tv", () => {
    const { url, headers } = buildTmdbSearchRequest("tv", "Amélie & co", { kind: "apiKey", value: "k123" });
    expect(url).toMatch(/^https:\/\/api\.themoviedb\.org\/3\/search\/tv\?/);
    expect(url).toContain("query=Am%C3%A9lie+%26+co"); // accents and & are encoded
    expect(url).toContain("api_key=k123");
    expect(headers.authorization).toBeUndefined();
  });
});

describe("createTmdbSource (with a fake fetch, no live calls)", () => {
  // A stand-in for fetch: answers /search/movie with the movie sample, /search/tv with the series sample.
  const fakeFetch = (status = 200) =>
    vi.fn(async (url: string) => {
      const body = url.includes("/search/tv") ? sampleTv : sampleMovies;
      return new Response(JSON.stringify(body), { status });
    });
  const asFetch = (fn: ReturnType<typeof fakeFetch>) => fn as unknown as typeof fetch;

  it("asks for movies AND series, and converts both answers", async () => {
    const fetchFn = fakeFetch();
    const source = createTmdbSource({ kind: "token", value: "t" }, asFetch(fetchFn));
    const results = await source.search("  interstellar ", BOTH);

    expect(source.mode).toBe("live");
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const urls = fetchFn.mock.calls.map(([url]) => url);
    expect(urls.some((u) => u.includes("/search/movie?query=interstellar&"))).toBe(true); // trimmed
    expect(urls.some((u) => u.includes("/search/tv?"))).toBe(true);
    expect(results[0]).toMatchObject({ type: "movie", title: "Interstellar", year: 2014 });
    expect(results.some((r) => r.type === "series")).toBe(true);
  });

  it("only asks for the wanted type, and respects the limit", async () => {
    const fetchFn = fakeFetch();
    const results = await createTmdbSource({ kind: "apiKey", value: "k" }, asFetch(fetchFn)).search("x", {
      types: ["series"],
      limit: 3,
    });
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(fetchFn.mock.calls[0][0]).toContain("/search/tv?");
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.type === "series")).toBe(true);
  });

  it("doesn't call TMDB for an empty search", async () => {
    const fetchFn = fakeFetch();
    expect(await createTmdbSource({ kind: "apiKey", value: "k" }, asFetch(fetchFn)).search("   ", BOTH)).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("explains a refused key, rate limits and other errors", async () => {
    const creds = { kind: "apiKey", value: "bad" } as const;
    await expect(createTmdbSource(creds, asFetch(fakeFetch(401))).search("x", BOTH)).rejects.toThrow("refused the key");
    await expect(createTmdbSource(creds, asFetch(fakeFetch(429))).search("x", BOTH)).rejects.toThrow("Too many");
    await expect(createTmdbSource(creds, asFetch(fakeFetch(500))).search("x", BOTH)).rejects.toThrow("error 500");
  });

  it("explains a network failure", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(createTmdbSource({ kind: "token", value: "t" }, offline).search("x", BOTH)).rejects.toThrow(
      "Couldn't reach TMDB",
    );
  });
});

describe("sample search", () => {
  it("finds movies by part of the title, ignoring case and punctuation", async () => {
    const source = createTmdbSampleSource();
    expect(source.mode).toBe("sample");
    const titles = async (q: string) => (await source.search(q, { types: ["movie"], limit: 20 })).map((r) => r.title);
    expect(await titles("DARK knight")).toEqual(["The Dark Knight"]);
    expect(await titles("your name")).toEqual(["Your Name."]);
  });

  it("also matches the original title", async () => {
    const results = await createTmdbSampleSource().search("君の名は", BOTH);
    expect(results.map((r) => r.sourceId)).toEqual(["372058"]);
    const series = await createTmdbSampleSource().search("進撃", BOTH);
    expect(series.map((r) => r.title)).toEqual(["Attack on Titan"]);
  });

  it("finds movies and series together", async () => {
    // "witcher" is only a series in the sample; "dune" only movies.
    expect((await createTmdbSampleSource().search("witcher", BOTH)).map((r) => r.type)).toEqual(["series"]);
    expect((await createTmdbSampleSource().search("dune", BOTH)).map((r) => r.title)).toEqual([
      "Dune",
      "Dune: Part Two",
    ]);
  });

  it("puts the most popular first, like TMDB", () => {
    // "the" matches several titles; popularity decides the order.
    const popularity = searchTmdbMovieSample("the").results.map((m) => m.popularity);
    expect(popularity.length).toBeGreaterThan(2);
    expect(popularity).toEqual([...popularity].sort((a, b) => b - a));
  });

  it("returns nothing for an empty search or an unknown title", async () => {
    const source = createTmdbSampleSource();
    expect(await source.search("", BOTH)).toEqual([]);
    expect(await source.search("zzzz not a movie", BOTH)).toEqual([]);
  });

  it("answers in TMDB's own shape", () => {
    expect(searchTmdbMovieSample("matrix")).toMatchObject({ page: 1, total_pages: 1, total_results: 1 });
    expect(searchTmdbMovieSample("matrix").results[0].id).toBe(603);
    expect(searchTmdbTvSample("breaking").results[0]).toMatchObject({ id: 1396, name: "Breaking Bad" });
  });
});
