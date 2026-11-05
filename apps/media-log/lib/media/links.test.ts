import { describe, expect, it } from "vitest";
import { mediaItemPath, parseMediaItemParams } from "./links";

describe("mediaItemPath", () => {
  it("builds /media/<type>/<source>-<source id>", () => {
    expect(mediaItemPath({ type: "anime", source: "anilist", source_id: "16498" })).toBe("/media/anime/anilist-16498");
    expect(mediaItemPath({ type: "book", source: "openlibrary", source_id: "OL893415W" })).toBe(
      "/media/book/openlibrary-OL893415W",
    );
  });

  it("encodes characters that would break the address", () => {
    expect(mediaItemPath({ type: "game", source: "igdb", source_id: "a/b c" })).toBe("/media/game/igdb-a%2Fb%20c");
  });
});

describe("parseMediaItemParams", () => {
  it("reads the parts back", () => {
    expect(parseMediaItemParams("anime", "anilist-16498")).toEqual({ type: "anime", source: "anilist", sourceId: "16498" });
  });

  it("round-trips with mediaItemPath, even with odd ids", () => {
    const item = { type: "game" as const, source: "igdb" as const, source_id: "a/b c-1" };
    const [, , type, id] = mediaItemPath(item).split("/");
    expect(parseMediaItemParams(type, id)).toEqual({ type: "game", source: "igdb", sourceId: "a/b c-1" });
  });

  it("splits at the first dash only", () => {
    expect(parseMediaItemParams("movie", "tmdb-12-34")).toEqual({ type: "movie", source: "tmdb", sourceId: "12-34" });
  });

  it("returns null for wrong addresses", () => {
    expect(parseMediaItemParams("podcast", "tmdb-1")).toBeNull(); // unknown type
    expect(parseMediaItemParams("movie", "netflix-1")).toBeNull(); // unknown source
    expect(parseMediaItemParams("movie", "tmdb")).toBeNull(); // no dash
    expect(parseMediaItemParams("movie", "tmdb-")).toBeNull(); // no id
    expect(parseMediaItemParams("movie", "tmdb-%E0%A4%A")).toBeNull(); // broken % code
  });
});
