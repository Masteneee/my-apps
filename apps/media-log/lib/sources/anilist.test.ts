import { describe, expect, it, vi } from "vitest";
import {
  aniListMediaToMediaResult,
  buildAniListQuery,
  buildAniListRequest,
  convertAniListResponse,
  createAniListSampleSource,
  createAniListSource,
  searchAniListSample,
  type AniListMedia,
  type AniListSearchResponse,
} from "./anilist";
import sampleJson from "./samples/anilist-search.json";

// The saved sample is in AniList's real answer shape: { data: { anime: { media: [...] }, manga: ... } }.
const sample = sampleJson as AniListSearchResponse;
const aotAnime = sample.data!.anime!.media.find((m) => m.id === 16498)!;
const aotManga = sample.data!.manga!.media.find((m) => m.id === 53390)!;
const deathNoteManga = sample.data!.manga!.media.find((m) => m.id === 30021)!;

const BOTH = { types: ["anime", "manga"] as const, limit: 10 };

describe("aniListMediaToMediaResult", () => {
  it("converts an anime: English title, studio as creator, episodes as units", () => {
    expect(aniListMediaToMediaResult(aotAnime)).toEqual({
      type: "anime",
      source: "anilist",
      sourceId: "16498",
      title: "Attack on Titan",
      originalTitle: "進撃の巨人",
      year: 2013,
      coverUrl: aotAnime.coverImage!.large,
      creators: ["Wit Studio"],
      totalUnits: 25,
      // HTML tags removed, line breaks become spaces.
      overview:
        "Several hundred years ago, humans were nearly exterminated by titans. Titans are typically several stories tall, seem to have no intelligence and devour human beings. (Source: our own summary)",
    });
  });

  it("converts a manga: writer/artist as creators (not translators), chapters as units", () => {
    const result = aniListMediaToMediaResult(aotManga);
    expect(result).toMatchObject({ type: "manga", sourceId: "53390", totalUnits: 141, year: 2009 });
    expect(result.creators).toEqual(["Hajime Isayama"]);
    expect(aniListMediaToMediaResult(deathNoteManga).creators).toEqual(["Tsugumi Ohba", "Takeshi Obata"]);
  });

  it("falls back to the romaji, then the native title", () => {
    const noEnglish: AniListMedia = { ...aotAnime, title: { english: null, romaji: "Shingeki no Kyojin", native: "進撃の巨人" } };
    expect(aniListMediaToMediaResult(noEnglish)).toMatchObject({ title: "Shingeki no Kyojin", originalTitle: "進撃の巨人" });
    const onlyNative: AniListMedia = { ...aotAnime, title: { english: null, romaji: null, native: "進撃の巨人" } };
    expect(aniListMediaToMediaResult(onlyNative)).toMatchObject({ title: "進撃の巨人", originalTitle: null });
  });

  it("handles missing values (still airing, no cover, no date)", () => {
    const result = aniListMediaToMediaResult({
      ...aotAnime,
      episodes: null,
      coverImage: null,
      startDate: { year: null, month: null, day: null },
      description: null,
      studios: null,
    });
    expect(result).toMatchObject({ totalUnits: null, coverUrl: null, year: null, overview: null, creators: [] });
  });
});

describe("convertAniListResponse", () => {
  it("converts every entry in the saved sample, anime first", () => {
    const results = convertAniListResponse(sample);
    expect(results).toHaveLength(sample.data!.anime!.media.length + sample.data!.manga!.media.length);
    expect(results[0].type).toBe("anime");
    expect(results.at(-1)!.type).toBe("manga");
    // "anime 16498" and "manga 53390" are different ids; no duplicate keys.
    expect(new Set(results.map((r) => `${r.type}-${r.sourceId}`)).size).toBe(results.length);
  });

  it("skips adult entries, light novels and broken entries", () => {
    const results = convertAniListResponse({
      data: {
        anime: { media: [aotAnime, { ...aotAnime, id: 2, isAdult: true }, { id: 3 }, null] },
        manga: { media: [aotManga, { ...aotManga, id: 4, format: "NOVEL" }] },
      },
    });
    expect(results.map((r) => r.sourceId)).toEqual(["16498", "53390"]);
  });

  it("returns an empty list for errors and junk", () => {
    expect(convertAniListResponse({ data: null, errors: [{ message: "Not Found." }] })).toEqual([]);
    expect(convertAniListResponse("oops")).toEqual([]);
    expect(convertAniListResponse({ data: { anime: { media: "?" } } })).toEqual([]);
  });
});

describe("building the GraphQL request", () => {
  it("only asks for the parts it needs", () => {
    const both = buildAniListQuery(["anime", "manga"]);
    expect(both).toContain("anime: Page");
    expect(both).toContain("manga: Page");
    expect(both).toContain("type: MANGA, isAdult: false, format_not: NOVEL");
    const animeOnly = buildAniListQuery(["anime"]);
    expect(animeOnly).toContain("anime: Page");
    expect(animeOnly).not.toContain("manga: Page");
  });

  it("sends the search text as a variable, never inside the query", () => {
    const { url, init } = buildAniListRequest('Naruto" } evil {', { types: ["manga"], limit: 5 });
    expect(url).toBe("https://graphql.anilist.co");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.variables).toEqual({ search: 'Naruto" } evil {', perPage: 5 });
    expect(body.query).not.toContain("Naruto");
  });
});

describe("createAniListSource (with a fake fetch, no live calls)", () => {
  const fakeFetch = (status: number, body: unknown = sample) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it("POSTs to AniList and converts the answer", async () => {
    const fetchFn = fakeFetch(200);
    const results = await createAniListSource(fetchFn as unknown as typeof fetch).search("titan", BOTH);
    expect(fetchFn).toHaveBeenCalledOnce();
    expect(results.find((r) => r.sourceId === "16498")).toMatchObject({ type: "anime", title: "Attack on Titan" });
  });

  it("doesn't call AniList for an empty search or a type it doesn't have", async () => {
    const fetchFn = fakeFetch(200);
    const source = createAniListSource(fetchFn as unknown as typeof fetch);
    expect(await source.search("  ", BOTH)).toEqual([]);
    expect(await source.search("titan", { types: [], limit: 10 })).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("explains HTTP errors and GraphQL errors", async () => {
    const asFetch = (f: ReturnType<typeof fakeFetch>) => f as unknown as typeof fetch;
    await expect(createAniListSource(asFetch(fakeFetch(429))).search("x", BOTH)).rejects.toThrow("Too many");
    await expect(createAniListSource(asFetch(fakeFetch(500))).search("x", BOTH)).rejects.toThrow("error 500");
    const graphqlError = fakeFetch(200, { data: null, errors: [{ message: "Validation error" }] });
    await expect(createAniListSource(asFetch(graphqlError)).search("x", BOTH)).rejects.toThrow(
      "AniList had a problem: Validation error",
    );
  });
});

describe("AniList sample search", () => {
  it("matches English, romaji, native titles and synonyms", async () => {
    const source = createAniListSampleSource();
    expect(source.mode).toBe("sample");
    const ids = async (q: string) => (await source.search(q, BOTH)).map((r) => `${r.type}-${r.sourceId}`);
    expect(await ids("attack on titan")).toEqual(["anime-16498", "manga-53390"]);
    expect(await ids("shingeki")).toEqual(["anime-16498", "manga-53390"]);
    expect(await ids("千と千尋")).toEqual(["anime-199"]);
    expect(await ids("FMA:B")).toEqual(["anime-5114"]);
  });

  it("only answers the parts asked for, in AniList's shape", () => {
    const answer = searchAniListSample("planetes", { types: ["manga"], limit: 10 });
    expect(answer.data?.anime).toBeUndefined();
    expect(answer.data?.manga?.media.map((m) => m.id)).toEqual([30044]);
  });

  it("returns nothing for an empty search", async () => {
    expect(await createAniListSampleSource().search("", BOTH)).toEqual([]);
  });
});
