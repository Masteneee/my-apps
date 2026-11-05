import { describe, expect, it } from "vitest";
import { genresToTags, genreToTags, sortTags, TAG_LABELS, tagKey, tagListLabel, TAGS } from "./tags";

describe("tagKey", () => {
  it("makes different spellings of the same word meet", () => {
    expect(tagKey("Sci-Fi")).toBe("sci fi");
    expect(tagKey("  SCIENCE   Fiction ")).toBe("science fiction");
    expect(tagKey("Children's stories")).toBe("childrens stories");
    expect(tagKey("Beat 'em up")).toBe("beat em up");
    expect(tagKey("Mars (Planet)")).toBe("mars planet");
    expect(tagKey("Comédie")).toBe("comedie");
  });
});

describe("genreToTags", () => {
  it("matches Sci-Fi, Science Fiction and science fiction across sources", () => {
    expect(genreToTags("Sci-Fi")).toEqual(["sci-fi"]); // AniList
    expect(genreToTags("Science Fiction")).toEqual(["sci-fi"]); // TMDB
    expect(genreToTags("science fiction")).toEqual(["sci-fi"]); // Open Library
    expect(genreToTags("Science fiction")).toEqual(["sci-fi"]); // IGDB
  });

  it("splits TMDB's double genres", () => {
    expect(genreToTags("Sci-Fi & Fantasy")).toEqual(["sci-fi", "fantasy"]);
    expect(genreToTags("Action & Adventure")).toEqual(["adventure", "action"]);
    expect(genreToTags("War & Politics")).toEqual(["war"]); // "politics" has no tag
  });

  it("reads Open Library's long subjects piece by piece", () => {
    expect(genreToTags("Fiction, science fiction, general")).toEqual(["sci-fi"]);
    expect(genreToTags("Fiction, science fiction, action & adventure")).toEqual(["sci-fi", "adventure", "action"]);
    expect(genreToTags("Space flight -- Fiction")).toEqual(["space"]);
    expect(genreToTags("Fiction, fantasy, epic")).toEqual(["fantasy"]);
  });

  it("keeps a whole phrase that has its own meaning", () => {
    // Not split into "detective" + "mystery stories": the phrase itself is known.
    expect(genreToTags("Detective and mystery stories")).toEqual(["mystery", "crime"]);
    expect(genreToTags("Hack and slash/Beat 'em up")).toEqual(["action"]);
    expect(genreToTags("Psychological thriller")).toEqual(["psychological", "thriller"]);
  });

  it("accepts a plural", () => {
    expect(genreToTags("Thrillers")).toEqual(["thriller"]);
    expect(genreToTags("Space operas")).toEqual(["space", "sci-fi"]);
  });

  it("gives no tag to formats and unknown words", () => {
    for (const word of [
      "Animation",
      "Documentary",
      "Fiction",
      "Indie",
      "Role-playing (RPG)",
      "Open world",
      "",
      "Families",
    ]) {
      expect(genreToTags(word), word).toEqual([]);
    }
  });
});

describe("genresToTags", () => {
  it("merges an item's genres into unique tags, most specific first", () => {
    // AniList's Planetes: genres + a tag.
    expect(genresToTags(["Drama", "Romance", "Sci-Fi", "Space"])).toEqual(["space", "sci-fi", "romance", "drama"]);
    // Repeats and unknown words disappear.
    expect(genresToTags(["Science fiction", "Sci-Fi", "Fiction", "sci fi"])).toEqual(["sci-fi"]);
    expect(genresToTags([])).toEqual([]);
  });
});

describe("sortTags and labels", () => {
  it("sorts in TAGS order and removes repeats", () => {
    expect(sortTags(["drama", "space", "drama", "comedy"])).toEqual(["space", "comedy", "drama"]);
  });

  it("has a label for every tag", () => {
    for (const tag of TAGS) expect(TAG_LABELS[tag]).toBeTruthy();
    expect(tagListLabel(["space", "sci-fi"])).toBe("Space, Sci-Fi");
  });
});
