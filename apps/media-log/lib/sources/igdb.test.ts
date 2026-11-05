import { describe, expect, it, vi } from "vitest";
import {
  buildIgdbQuery,
  convertIgdbResponse,
  createIgdbSampleSource,
  createIgdbSource,
  createTwitchTokenProvider,
  igdbGameToMediaResult,
  pickIgdbCredentials,
  searchIgdbSample,
  yearFromUnixSeconds,
  type IgdbSearchResponse,
  type TokenProvider,
} from "./igdb";
import sampleJson from "./samples/igdb-games.json";

const sample = sampleJson as IgdbSearchResponse;
const witcher3 = sample.find((g) => g.id === 1942)!;
const GAMES = { types: ["game"] as const, limit: 10 };
const CREDS = { clientId: "my-client-id", clientSecret: "my-secret" };

describe("igdbGameToMediaResult", () => {
  it("converts a game: year from a Unix timestamp, the developer as creator", () => {
    expect(igdbGameToMediaResult(witcher3)).toEqual({
      type: "game",
      source: "igdb",
      sourceId: "1942",
      title: "The Witcher 3: Wild Hunt",
      originalTitle: null,
      year: 2015,
      coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg",
      creators: ["CD Projekt RED"], // the developer, not the publisher
      totalUnits: null,
      overview: witcher3.summary,
    });
  });

  it("uses every company when no developer is marked, and handles missing fields", () => {
    const result = igdbGameToMediaResult({
      id: 5,
      name: "Bare Game",
      involved_companies: [{ id: 1, developer: false, company: { id: 9, name: "Some Publisher" } }],
    });
    expect(result).toMatchObject({ year: null, coverUrl: null, overview: null, creators: ["Some Publisher"] });
  });

  it("reads Unix timestamps in seconds", () => {
    expect(yearFromUnixSeconds(1431993600)).toBe(2015); // 19 May 2015
    expect(yearFromUnixSeconds(0)).toBe(1970); // second 0 = 1 January 1970
    expect(yearFromUnixSeconds(undefined)).toBeNull();
  });
});

describe("convertIgdbResponse", () => {
  it("converts every game in the saved sample", () => {
    const results = convertIgdbResponse(sample);
    expect(results).toHaveLength(sample.length);
    expect(results.every((r) => r.type === "game" && r.source === "igdb")).toBe(true);
  });

  it("skips broken entries, and answers that aren't a list", () => {
    expect(convertIgdbResponse([witcher3, { id: 2 }, { name: "no id" }, null]).map((r) => r.sourceId)).toEqual(["1942"]);
    expect(convertIgdbResponse({ message: "Authorization Failure" })).toEqual([]);
  });
});

describe("pickIgdbCredentials", () => {
  it("needs both the client id and the secret", () => {
    expect(pickIgdbCredentials({ IGDB_CLIENT_ID: " id ", IGDB_CLIENT_SECRET: "s" })).toEqual({
      clientId: "id",
      clientSecret: "s",
    });
    expect(pickIgdbCredentials({ IGDB_CLIENT_ID: "id" })).toBeNull();
    expect(pickIgdbCredentials({})).toBeNull();
  });
});

describe("buildIgdbQuery", () => {
  it("writes an Apicalypse query", () => {
    expect(buildIgdbQuery("zelda", 8)).toBe(
      [
        'search "zelda";',
        "fields name,first_release_date,summary,cover.image_id,involved_companies.developer,involved_companies.company.name;",
        "where version_parent = null & themes != (42);",
        "limit 8;",
      ].join("\n"),
    );
  });

  it("escapes quotes and backslashes so the text can't end early", () => {
    expect(buildIgdbQuery('say "hi" \\o/', 1)).toContain('search "say \\"hi\\" \\\\o/";');
  });
});

describe("createTwitchTokenProvider (fake fetch and a fake clock)", () => {
  const tokenFetch = () =>
    vi.fn(async () => new Response(JSON.stringify({ access_token: "tok-1", expires_in: 3600, token_type: "bearer" })));

  it("asks Twitch once, then reuses the token until it's about to expire", async () => {
    const fetchFn = tokenFetch();
    let clock = 0;
    const tokens = createTwitchTokenProvider(CREDS, fetchFn as unknown as typeof fetch, () => clock);

    expect(await tokens.get()).toBe("tok-1");
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("https://id.twitch.tv/oauth2/token?client_id=my-client-id");
    expect(url).toContain("grant_type=client_credentials");
    expect(init.method).toBe("POST");

    clock = 30 * 60 * 1000; // 30 minutes later: still valid
    await tokens.get();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    clock = 59.5 * 60 * 1000; // 30 seconds before expiry: renew early
    await tokens.get();
    expect(fetchFn).toHaveBeenCalledTimes(2);

    tokens.forget();
    await tokens.get();
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("explains a wrong client id or secret", async () => {
    const refused = vi.fn(async () => new Response('{"message":"invalid client secret"}', { status: 403 }));
    await expect(createTwitchTokenProvider(CREDS, refused as unknown as typeof fetch).get()).rejects.toThrow(
      "refused the key. Check IGDB_CLIENT_ID / IGDB_CLIENT_SECRET",
    );
  });
});

describe("createIgdbSource (with a fake fetch and fake tokens, no live calls)", () => {
  // A fake token store: always the same token, and `forget` records its calls.
  const fakeTokens = () => ({ get: async () => "tok-1", forget: vi.fn<TokenProvider["forget"]>() });

  it("sends the client id, the token and the query, and converts the answer", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(sample.slice(0, 2))));
    const source = createIgdbSource(CREDS, fetchFn as unknown as typeof fetch, fakeTokens());
    const results = await source.search("witcher", GAMES);

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe("https://api.igdb.com/v4/games");
    expect(init.method).toBe("POST");
    expect(headers["client-id"]).toBe("my-client-id");
    expect(headers.authorization).toBe("Bearer tok-1");
    expect(init.body).toContain('search "witcher";');
    expect(results.map((r) => r.title)).toEqual(["The Witcher 3: Wild Hunt", "The Witcher"]);
    // The secret is only ever sent to Twitch, never to IGDB.
    expect(JSON.stringify(init)).not.toContain("my-secret");
  });

  it("forgets a refused token so the next search gets a new one", async () => {
    const tokens = fakeTokens();
    const fetchFn = vi.fn(async () => new Response("{}", { status: 401 }));
    await expect(createIgdbSource(CREDS, fetchFn as unknown as typeof fetch, tokens).search("x", GAMES)).rejects.toThrow(
      "IGDB refused the key",
    );
    expect(tokens.forget).toHaveBeenCalledOnce();
  });

  it("doesn't call anything for an empty search", async () => {
    const fetchFn = vi.fn();
    expect(await createIgdbSource(CREDS, fetchFn as unknown as typeof fetch, fakeTokens()).search(" ", GAMES)).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("IGDB sample search", () => {
  it("finds games by part of the name", async () => {
    const source = createIgdbSampleSource();
    expect(source.mode).toBe("sample");
    expect((await source.search("dune", GAMES)).map((r) => r.title)).toEqual([
      "Dune: Spice Wars",
      "Dune II: The Building of a Dynasty",
    ]);
    expect(searchIgdbSample("witcher", 1)).toHaveLength(1);
  });
});
