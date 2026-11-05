import { describe, expect, it } from "vitest";
import { DEMO_ITEMS } from "../demo/seed";
import { COVER_HOSTS, isOptimizableCover } from "./covers";

describe("isOptimizableCover", () => {
  it("accepts the covers our 4 sources give", () => {
    expect(isOptimizableCover("https://image.tmdb.org/t/p/w342/abc.jpg")).toBe(true);
    expect(isOptimizableCover("https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.png")).toBe(true);
    expect(isOptimizableCover("https://covers.openlibrary.org/b/id/123-M.jpg")).toBe(true);
    expect(isOptimizableCover("https://images.igdb.com/igdb/image/upload/t_cover_big/co1.jpg")).toBe(true);
  });

  it("accepts every demo item's cover", () => {
    for (const item of Object.values(DEMO_ITEMS)) expect(isOptimizableCover(item.cover_url), item.title).toBe(true);
  });

  it("refuses other hosts, look-alike hosts, http and custom ports", () => {
    expect(isOptimizableCover("https://example.com/poster.jpg")).toBe(false);
    // The host must match exactly: these only CONTAIN an allowed name.
    expect(isOptimizableCover("https://image.tmdb.org.evil.com/x.jpg")).toBe(false);
    expect(isOptimizableCover("https://evil.com/image.tmdb.org/x.jpg")).toBe(false);
    expect(isOptimizableCover("http://image.tmdb.org/t/p/w342/abc.jpg")).toBe(false);
    expect(isOptimizableCover("https://image.tmdb.org:8443/t/p/w342/abc.jpg")).toBe(false);
  });

  it("refuses empty values and text that isn't an address", () => {
    expect(isOptimizableCover(null)).toBe(false);
    expect(isOptimizableCover(undefined)).toBe(false);
    expect(isOptimizableCover("")).toBe(false);
    expect(isOptimizableCover("not a url")).toBe(false);
  });

  it("lists each host once", () => {
    expect(new Set(COVER_HOSTS).size).toBe(COVER_HOSTS.length);
  });
});
