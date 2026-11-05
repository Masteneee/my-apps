import { describe, expect, it, vi } from "vitest";
import {
  CACHEABLE_SEARCH,
  SOURCE_REVALIDATE_SECONDS,
  UNCACHEABLE_SEARCH,
  searchCacheControl,
  withRevalidate,
} from "./cache";
import type { SourceStatus } from "./types";

describe("withRevalidate", () => {
  it("adds next.revalidate and keeps every other option", async () => {
    const fake = vi.fn(async () => new Response("{}"));
    const signal = AbortSignal.timeout(1000);
    const cached = withRevalidate(fake as unknown as typeof fetch, 120);

    await cached("https://graphql.anilist.co", { method: "POST", body: '{"q":1}', headers: { a: "b" }, signal });

    expect(fake).toHaveBeenCalledWith("https://graphql.anilist.co", {
      method: "POST",
      body: '{"q":1}',
      headers: { a: "b" },
      signal,
      next: { revalidate: 120 },
    });
  });

  it("works without options, with 1 hour by default", async () => {
    const fake = vi.fn(async () => new Response("{}"));
    await withRevalidate(fake as unknown as typeof fetch)("https://example.com");
    expect(fake).toHaveBeenCalledWith("https://example.com", { next: { revalidate: SOURCE_REVALIDATE_SECONDS } });
  });

  it("keeps other `next` options such as tags", async () => {
    const fake = vi.fn(async () => new Response("{}"));
    await withRevalidate(fake as unknown as typeof fetch, 60)("https://example.com", { next: { tags: ["tmdb"] } });
    expect(fake).toHaveBeenCalledWith("https://example.com", { next: { tags: ["tmdb"], revalidate: 60 } });
  });

  it("returns the answer unchanged", async () => {
    const answer = new Response('{"ok":true}');
    const cached = withRevalidate((async () => answer) as unknown as typeof fetch);
    expect(await cached("https://example.com")).toBe(answer);
  });
});

const status = (fields: Partial<SourceStatus>): SourceStatus => ({
  source: "tmdb",
  label: "TMDB",
  types: ["movie", "series"],
  state: "live",
  ...fields,
});

describe("searchCacheControl", () => {
  it("caches answers where every source answered", () => {
    expect(searchCacheControl({ sources: [status({}), status({ source: "anilist", label: "AniList" })] })).toBe(
      CACHEABLE_SEARCH,
    );
  });

  it("caches answers from samples chosen on purpose (no key, or forced)", () => {
    const sources = [status({ state: "sample", sampleReason: "no-key" }), status({ state: "sample", sampleReason: "forced" })];
    expect(searchCacheControl({ sources })).toBe(CACHEABLE_SEARCH);
  });

  it("never caches an answer where a source failed", () => {
    expect(searchCacheControl({ sources: [status({}), status({ state: "error", error: "TMDB refused the key." })] })).toBe(
      UNCACHEABLE_SEARCH,
    );
  });

  it("never caches an answer where a live call fell back to the sample", () => {
    const sources = [status({ source: "anilist", state: "sample", sampleReason: "live-failed", error: "offline" })];
    expect(searchCacheControl({ sources })).toBe(UNCACHEABLE_SEARCH);
  });

  it("caches the empty answer (no sources asked)", () => {
    expect(searchCacheControl({ sources: [] })).toBe(CACHEABLE_SEARCH);
  });

  it("lets the browser keep it 1 minute and the CDN 1 hour", () => {
    expect(CACHEABLE_SEARCH).toContain("public");
    expect(CACHEABLE_SEARCH).toContain("max-age=60");
    expect(CACHEABLE_SEARCH).toContain("s-maxage=3600");
  });
});
