import { describe, expect, it, vi } from "vitest";
import { createSourceEntries, samplesForced } from "./setup";

// Shows each entry as "source:mode(+fallback)/reason", easy to compare.
function describeEntries(entries: ReturnType<typeof createSourceEntries>) {
  return entries.map(
    (e) => `${e.adapter.source}:${e.adapter.mode}${e.fallback ? "+sample" : ""}${e.sampleReason ? `/${e.sampleReason}` : ""}`,
  );
}

describe("createSourceEntries", () => {
  it("with no keys: TMDB and IGDB use samples, AniList and Open Library go live with a sample fallback", () => {
    expect(describeEntries(createSourceEntries({}))).toEqual([
      "tmdb:sample/no-key",
      "anilist:live+sample",
      "openlibrary:live+sample",
      "igdb:sample/no-key",
    ]);
  });

  it("with keys: TMDB and IGDB go live, without a fallback (a wrong key should show)", () => {
    const env = { TMDB_API_KEY: "k", IGDB_CLIENT_ID: "id", IGDB_CLIENT_SECRET: "secret" };
    expect(describeEntries(createSourceEntries(env))).toEqual([
      "tmdb:live",
      "anilist:live+sample",
      "openlibrary:live+sample",
      "igdb:live",
    ]);
  });

  it("IGDB needs both the id and the secret", () => {
    expect(describeEntries(createSourceEntries({ IGDB_CLIENT_ID: "id" })).at(-1)).toBe("igdb:sample/no-key");
  });

  it("MEDIA_LOG_USE_SAMPLES=1 forces samples everywhere, even with keys", () => {
    const env = { MEDIA_LOG_USE_SAMPLES: "1", TMDB_API_KEY: "k" };
    expect(describeEntries(createSourceEntries(env))).toEqual([
      "tmdb:sample/forced",
      "anilist:sample/forced",
      "openlibrary:sample/forced",
      "igdb:sample/forced",
    ]);
  });

  it("uses the given token store for IGDB", () => {
    const igdbTokens = vi.fn(() => ({ get: async () => "t", forget: () => {} }));
    createSourceEntries({ IGDB_CLIENT_ID: "id", IGDB_CLIENT_SECRET: "s" }, { igdbTokens });
    expect(igdbTokens).toHaveBeenCalledWith({ clientId: "id", clientSecret: "s" });
  });
});

describe("samplesForced", () => {
  it("accepts 1, true and yes", () => {
    expect(samplesForced({ MEDIA_LOG_USE_SAMPLES: "1" })).toBe(true);
    expect(samplesForced({ MEDIA_LOG_USE_SAMPLES: " TRUE " })).toBe(true);
    expect(samplesForced({ MEDIA_LOG_USE_SAMPLES: "yes" })).toBe(true);
    expect(samplesForced({ MEDIA_LOG_USE_SAMPLES: "0" })).toBe(false);
    expect(samplesForced({})).toBe(false);
  });
});
