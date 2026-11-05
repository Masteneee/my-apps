import { describe, expect, it, vi } from "vitest";
import sample from "./sample-search-response.json";
import {
  buildTmdbSearchRequest,
  createSampleMovieSearch,
  createTmdbMovieSearch,
  pickTmdbCredentials,
  searchSampleResponse,
} from "./search";

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
    const { url, headers } = buildTmdbSearchRequest("spirited away", { kind: "token", value: "eyJsecret" });
    expect(url).toBe(
      "https://api.themoviedb.org/3/search/movie?query=spirited+away&include_adult=false&language=en-US&page=1",
    );
    expect(headers.authorization).toBe("Bearer eyJsecret");
    expect(url).not.toContain("eyJsecret");
  });

  it("sends an API key as ?api_key=", () => {
    const { url, headers } = buildTmdbSearchRequest("Amélie & co", { kind: "apiKey", value: "k123" });
    expect(url).toContain("query=Am%C3%A9lie+%26+co"); // accents and & are encoded
    expect(url).toContain("api_key=k123");
    expect(headers.authorization).toBeUndefined();
  });
});

describe("createTmdbMovieSearch (with a fake fetch, no live calls)", () => {
  // A stand-in for fetch that answers with the saved sample.
  const fakeFetch = (status: number, body: unknown = sample) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it("calls TMDB and converts the answer", async () => {
    const fetchFn = fakeFetch(200);
    const search = createTmdbMovieSearch({ kind: "token", value: "t" }, fetchFn);
    const results = await search.search("  interstellar ");

    expect(search.usesSample).toBe(false);
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("query=interstellar&"); // trimmed
    expect(results[0]).toMatchObject({ source: "tmdb", title: "Interstellar", year: 2014 });
  });

  it("doesn't call TMDB for an empty search", async () => {
    const fetchFn = fakeFetch(200);
    expect(await createTmdbMovieSearch({ kind: "apiKey", value: "k" }, fetchFn).search("   ")).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("explains a refused key, rate limits and other errors", async () => {
    const creds = { kind: "apiKey", value: "bad" } as const;
    await expect(createTmdbMovieSearch(creds, fakeFetch(401)).search("x")).rejects.toThrow("refused the key");
    await expect(createTmdbMovieSearch(creds, fakeFetch(429)).search("x")).rejects.toThrow("Too many");
    await expect(createTmdbMovieSearch(creds, fakeFetch(500)).search("x")).rejects.toThrow("error 500");
  });

  it("explains a network failure", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(createTmdbMovieSearch({ kind: "token", value: "t" }, offline).search("x")).rejects.toThrow(
      "Couldn't reach TMDB",
    );
  });
});

describe("sample search", () => {
  it("finds movies by part of the title, ignoring case and punctuation", async () => {
    const search = createSampleMovieSearch();
    expect(search.usesSample).toBe(true);
    expect((await search.search("DARK knight")).map((r) => r.title)).toEqual(["The Dark Knight"]);
    expect((await search.search("your name")).map((r) => r.title)).toEqual(["Your Name."]);
  });

  it("also matches the original title", async () => {
    expect((await createSampleMovieSearch().search("君の名は")).map((r) => r.sourceId)).toEqual(["372058"]);
  });

  it("puts the most popular first, like TMDB", () => {
    // "the" matches several titles; popularity decides the order.
    const popularity = searchSampleResponse("the").results.map((m) => m.popularity);
    expect(popularity.length).toBeGreaterThan(2);
    expect(popularity).toEqual([...popularity].sort((a, b) => b - a));
  });

  it("returns nothing for an empty search or an unknown movie", async () => {
    const search = createSampleMovieSearch();
    expect(await search.search("")).toEqual([]);
    expect(await search.search("zzzz not a movie")).toEqual([]);
  });

  it("answers in TMDB's own shape", () => {
    const response = searchSampleResponse("matrix");
    expect(response).toMatchObject({ page: 1, total_pages: 1, total_results: 1 });
    expect(response.results[0].id).toBe(603);
  });
});
