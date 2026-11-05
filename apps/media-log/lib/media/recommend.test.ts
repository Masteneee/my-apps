import { describe, expect, it } from "vitest";
import { sampleCatalog } from "../sources/catalog";
import {
  bridgeAudience,
  bridgePicks,
  buildCandidatePool,
  favoritesFrom,
  fillGenres,
  fillLogGenres,
  mediaItemKey,
  pairScore,
  ratingLabel,
  reasonText,
  recommend,
  scoreCandidate,
  spreadByType,
  tagPoints,
  type Candidate,
  type Favorite,
  type Recommendation,
} from "./recommend";
import type { LogStatus, LogWithMedia, MediaItem, MediaResult, MediaType } from "./types";

// ---- small builders, so each test only says what matters ----

const SOURCE_OF: Record<MediaType, MediaItem["source"]> = {
  movie: "tmdb",
  series: "tmdb",
  anime: "anilist",
  manga: "anilist",
  book: "openlibrary",
  game: "igdb",
};

function item(title: string, type: MediaType, genres: string[], id = title): MediaItem {
  return {
    id: `db-${id}`,
    type,
    source: SOURCE_OF[type],
    source_id: id,
    title,
    year: 2020,
    cover_url: null,
    creators: [],
    total_units: null,
    genres,
    cached_at: "2026-11-01T12:00:00.000Z",
  };
}

function result(title: string, type: MediaType, genres: string[], id = title): MediaResult {
  return {
    type,
    source: SOURCE_OF[type],
    sourceId: id,
    title,
    originalTitle: null,
    year: 2020,
    coverUrl: null,
    creators: [],
    totalUnits: null,
    overview: null,
    genres,
  };
}

let logCount = 0;
function log(media: MediaItem, rating: number | null, status: LogStatus = "completed"): LogWithMedia {
  logCount += 1;
  return {
    id: `log-${logCount}`,
    user_id: "me",
    media_item_id: media.id,
    status,
    rating,
    progress: null,
    progress_unit: null,
    review_text: null,
    started_at: null,
    finished_at: null,
    rewatch: false,
    created_at: "2026-11-01T12:00:00.000Z",
    media,
  };
}

const interstellar = item("Interstellar", "movie", ["Adventure", "Drama", "Science Fiction"]);
const shawshank = item("The Shawshank Redemption", "movie", ["Drama", "Crime"]);
const hobbit = item("The Hobbit", "book", ["Fantasy fiction", "Adventure stories"]);

const bebop = result("Cowboy Bebop", "anime", ["Action", "Adventure", "Drama", "Sci-Fi", "Space"]);
const planetesManga = result("Planetes", "manga", ["Drama", "Sci-Fi", "Slice of Life", "Space"]);
const outerWilds = result("Outer Wilds", "game", ["Puzzle", "Adventure", "Science fiction", "Mystery"]);
const matrix = result("The Matrix", "movie", ["Action", "Science Fiction"]);
const hades = result("Hades", "game", ["Role-playing (RPG)", "Action", "Fantasy"]);
const stardew = result("Stardew Valley", "game", ["Simulator", "Romance"]);

const POOL = buildCandidatePool([], [bebop, planetesManga, outerWilds, matrix, hades, stardew]);

describe("mediaItemKey", () => {
  it("names an item by type, source and source id", () => {
    expect(mediaItemKey(interstellar)).toBe("movie:tmdb:Interstellar");
  });
});

describe("fillGenres / fillLogGenres", () => {
  const catalog = [result("Interstellar", "movie", ["Science Fiction"])];

  it("borrows the catalog's genres for an item cached before Stage 6", () => {
    const old = { ...interstellar, genres: [] };
    expect(fillGenres(old, catalog).genres).toEqual(["Science Fiction"]);
    expect(old.genres).toEqual([]); // the original isn't changed
  });

  it("keeps an item's own genres, and leaves unknown items alone", () => {
    expect(fillGenres(interstellar, catalog)).toBe(interstellar);
    const unknown = item("Unknown", "movie", []);
    expect(fillGenres(unknown, catalog)).toBe(unknown);
  });

  it("works on logs", () => {
    const filled = fillLogGenres([log({ ...interstellar, genres: [] }, 5)], catalog);
    expect(filled[0].media.genres).toEqual(["Science Fiction"]);
  });
});

describe("buildCandidatePool", () => {
  it("puts database items first (with their id), then catalog items not already there", () => {
    const pool = buildCandidatePool([item("Cowboy Bebop", "anime", ["Sci-Fi"])], [bebop, outerWilds]);
    expect(pool.map((c) => [c.media.title, c.mediaItemId])).toEqual([
      ["Cowboy Bebop", "db-Cowboy Bebop"],
      ["Outer Wilds", null],
    ]);
    expect(pool[1].tags).toEqual(["sci-fi", "mystery", "adventure"]);
  });

  it("fills an old database item's genres from the catalog", () => {
    const pool = buildCandidatePool([item("Cowboy Bebop", "anime", [])], [bebop]);
    expect(pool[0].tags).toContain("space");
  });
});

describe("favoritesFrom", () => {
  it("keeps items rated 4 or more, best first, each once (latest log)", () => {
    const favorites = favoritesFrom([
      log(hobbit, 4),
      log(interstellar, 5),
      log(shawshank, 3.5), // not a favorite
      log(interstellar, 2), // an OLDER log (logs are newest first): ignored
    ]);
    expect(favorites.map((f) => [f.title, f.rating])).toEqual([
      ["Interstellar", 5],
      ["The Hobbit", 4],
    ]);
    expect(favorites[0].tags).toEqual(["sci-fi", "adventure", "drama"]);
  });

  it("uses the LATEST rating when it went down", () => {
    expect(favoritesFrom([log(interstellar, 3), log(interstellar, 5)])).toEqual([]);
  });

  it("skips favorites without any tag (nothing to compare)", () => {
    expect(favoritesFrom([log(item("Mystery box", "movie", ["Documentary"]), 5)])).toEqual([]);
  });
});

describe("pairScore and scoreCandidate", () => {
  const fav5: Favorite = {
    key: "a",
    title: "Interstellar",
    type: "movie",
    rating: 5,
    tags: ["sci-fi", "adventure", "drama"],
  };
  const fav4: Favorite = { key: "b", title: "The Hobbit", type: "book", rating: 4, tags: ["fantasy", "adventure"] };
  const bebopCandidate = POOL.find((c) => c.media.title === "Cowboy Bebop")!;

  it("counts shared tag points × (rating − 3), broad tags half", () => {
    // Bebop shares sci-fi (1) + adventure (0.5) + drama (0.5) with Interstellar: 2 × (5 − 3) = 4.
    expect(pairScore(fav5, bebopCandidate)).toEqual({ score: 4, sharedTags: ["sci-fi", "adventure", "drama"] });
    // ...and adventure (0.5) with The Hobbit: 0.5 × (4 − 3) = 0.5.
    expect(pairScore(fav4, bebopCandidate)).toEqual({ score: 0.5, sharedTags: ["adventure"] });
  });

  it("lets one specific tag beat two broad ones", () => {
    // An Interstellar fan: Planetes (sci-fi + drama = 1.5) beats a dark fantasy that
    // only shares adventure + drama (1). Found while clicking through the app.
    const berserk = buildCandidatePool(
      [],
      [result("Berserk", "manga", ["Adventure", "Drama", "Fantasy", "Horror"])],
    )[0];
    const planetes = POOL.find((c) => c.media.title === "Planetes")!;
    expect(pairScore(fav5, planetes).score).toBe(3);
    expect(pairScore(fav5, berserk).score).toBe(2);
    expect(tagPoints("sci-fi")).toBe(1);
    expect(tagPoints("drama")).toBe(0.5);
  });

  it("never recommends the same media type", () => {
    const matrixCandidate = POOL.find((c) => c.media.title === "The Matrix")!;
    expect(pairScore(fav5, matrixCandidate).score).toBe(0);
  });

  it("keeps the best favorite as the reason and counts every match", () => {
    const rec = scoreCandidate(bebopCandidate, [fav4, fav5])!;
    expect(rec.because.title).toBe("Interstellar");
    expect(rec.score).toBe(4);
    expect(rec.favoritesMatched).toBe(2);
  });

  it("returns null when nothing matches", () => {
    const stardewCandidate = POOL.find((c) => c.media.title === "Stardew Valley")!;
    expect(scoreCandidate(stardewCandidate, [fav5, fav4])).toBeNull();
  });
});

describe("recommend", () => {
  it("ranks cross-media picks with an explainable reason", () => {
    const recs = recommend([log(interstellar, 5)], POOL);
    expect(recs.map((r) => r.candidate.media.title)).toEqual(["Cowboy Bebop", "Outer Wilds", "Planetes"]);
    // Not The Matrix (same type as Interstellar), not Hades or Stardew Valley (no shared tag).
    expect(reasonText(recs[0])).toBe("Because you rated Interstellar 5★: shares Sci-Fi, Adventure, Drama");
    // Outer Wilds (sci-fi, adventure) and Planetes (sci-fi, drama) both score 4: A to Z.
    expect(recs[1].score).toBe(recs[2].score);
  });

  it("skips what you already logged, even as 'want to watch'", () => {
    const bebopItem = item("Cowboy Bebop", "anime", bebop.genres);
    const recs = recommend([log(bebopItem, null, "planned"), log(interstellar, 5)], POOL);
    expect(recs.map((r) => r.candidate.media.title)).not.toContain("Cowboy Bebop");
  });

  it("is empty without favorites", () => {
    expect(recommend([log(interstellar, 3)], POOL)).toEqual([]);
    expect(recommend([], POOL)).toEqual([]);
  });

  it("can limit the types on both sides", () => {
    const recs = recommend([log(interstellar, 5), log(hobbit, 5)], POOL, {
      fromTypes: ["book"],
      toTypes: ["game"],
      limit: 1,
    });
    expect(recs.map((r) => [r.candidate.media.title, r.because.title])).toEqual([["Hades", "The Hobbit"]]);
  });
});

describe("ratingLabel", () => {
  it("writes half stars as decimals", () => {
    expect(ratingLabel(5)).toBe("5★");
    expect(ratingLabel(4.5)).toBe("4.5★");
  });
});

describe("bridgeAudience", () => {
  const anime = item("Frieren", "anime", ["Fantasy"]);
  const game = item("Hades", "game", ["Action"]);

  it("needs at least 3 different items", () => {
    expect(bridgeAudience([log(interstellar, 5), log(hobbit, 4)]).status).toBe("too-few");
    // Logging the same movie twice is still one item.
    expect(bridgeAudience([log(interstellar, 5), log(interstellar, 4), log(hobbit, 4)]).status).toBe("too-few");
  });

  it("is 'ok' when at least 3 out of 4 items are movies, series or books", () => {
    expect(bridgeAudience([log(interstellar, 5), log(hobbit, 4), log(shawshank, 4)])).toEqual({
      status: "ok",
      items: 3,
      mainstreamItems: 3,
    });
    expect(bridgeAudience([log(interstellar, 5), log(hobbit, 4), log(shawshank, 4), log(anime, 4)]).status).toBe("ok"); // 75%
  });

  it("is 'already-niche' below 75%", () => {
    const logs = [log(interstellar, 5), log(hobbit, 4), log(shawshank, 4), log(anime, 4), log(game, 4)]; // 60%
    expect(bridgeAudience(logs).status).toBe("already-niche");
  });
});

describe("spreadByType", () => {
  const rec = (title: string, type: MediaType, score: number): Recommendation => ({
    candidate: { media: result(title, type, []), mediaItemId: null, tags: [] } satisfies Candidate,
    because: { key: "x", title: "X", type: "movie", rating: 5, tags: [] },
    sharedTags: [],
    score,
    favoritesMatched: 1,
  });

  it("shows the best of each type first, then the rest, in score order", () => {
    const recs = [rec("A1", "anime", 9), rec("A2", "anime", 8), rec("G1", "game", 7), rec("M1", "manga", 2)];
    expect(spreadByType(recs, 3).map((r) => r.candidate.media.title)).toEqual(["A1", "G1", "M1"]);
    expect(spreadByType(recs, 10).map((r) => r.candidate.media.title)).toEqual(["A1", "G1", "M1", "A2"]);
  });
});

describe("bridgePicks", () => {
  const mainstream = [log(interstellar, 5), log(hobbit, 4.5), log(shawshank, 4)];

  it("recommends anime, manga and games from your movies, series and books", () => {
    const picks = bridgePicks(mainstream, POOL);
    expect(picks.map((p) => [p.candidate.media.type, p.candidate.media.title])).toEqual([
      ["anime", "Cowboy Bebop"],
      ["game", "Outer Wilds"],
      ["manga", "Planetes"],
    ]);
    expect(picks.every((p) => ["movie", "series", "book"].includes(p.because.type))).toBe(true);
  });

  it("is empty for someone who already logs mostly niche media", () => {
    const niche = ["A", "B", "C"].map((t) => log(item(t, "anime", ["Sci-Fi"]), 5));
    expect(bridgePicks([...niche, log(interstellar, 5)], POOL)).toEqual([]);
  });
});

describe("with the real saved samples", () => {
  it("bridges a sci-fi movie fan to niche picks, each with a reason", () => {
    const catalog = sampleCatalog();
    const pool = buildCandidatePool([], catalog);
    const logs = [
      log(interstellar, 5),
      log(item("Arrival", "movie", ["Drama", "Science Fiction", "Mystery"], "329865"), 4.5),
      log(hobbit, 4),
    ];
    const picks = bridgePicks(logs, pool);
    expect(picks).toHaveLength(3);
    expect(new Set(picks.map((p) => p.candidate.media.type))).toEqual(new Set(["anime", "manga", "game"]));
    for (const pick of picks) expect(reasonText(pick)).toMatch(/^Because you rated .+★: shares .+/);
  });
});
