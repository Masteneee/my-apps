import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStorage, type KeyValueStorage } from "../auth/mock";
import { createMockMediaStore, MOCK_MEDIA_STORAGE_KEY } from "./mock";
import type { MediaResult, MediaStore, NewLogInput } from "./types";

function result(sourceId: string, title: string): MediaResult {
  return {
    type: "movie",
    source: "tmdb",
    sourceId,
    title,
    originalTitle: null,
    year: 2014,
    coverUrl: null,
    creators: [],
    totalUnits: null,
    overview: null,
    genres: [],
  };
}
const interstellar = result("157336", "Interstellar");
const parasite = result("496243", "Parasite");

function logOf(media: MediaResult, extra: Partial<NewLogInput> = {}): NewLogInput {
  return { media, status: "completed", rating: 4, reviewText: "", finishedAt: null, rewatch: false, ...extra };
}

let storage: KeyValueStorage;
let currentUser: string | null;
let clock: number;
let store: MediaStore;

// Predictable ids ("id-1", "id-2"...) and a clock that moves 1 minute per call.
function makeStore() {
  let n = 0;
  return createMockMediaStore({
    storage,
    getCurrentUserId: async () => currentUser,
    makeId: () => `id-${++n}`,
    now: () => new Date(Date.UTC(2026, 10, 5, 12, clock++)),
  });
}

beforeEach(() => {
  storage = createMemoryStorage();
  currentUser = "user-1";
  clock = 0;
  store = makeStore();
});

describe("demo media store: adding logs", () => {
  it("needs you to be logged in", async () => {
    currentUser = null;
    await expect(store.addLog(logOf(interstellar))).rejects.toThrow("logged in");
    expect(storage.getItem(MOCK_MEDIA_STORAGE_KEY)).toBeNull();
  });

  it("saves a log with its cached media item", async () => {
    const log = await store.addLog(logOf(interstellar, { rating: 4.5, reviewText: " Wow " }));
    expect(log).toMatchObject({
      user_id: "user-1",
      status: "completed",
      rating: 4.5,
      review_text: "Wow",
      progress: null,
      media: { type: "movie", source: "tmdb", source_id: "157336", title: "Interstellar" },
    });
    expect(log.media_item_id).toBe(log.media.id);
  });

  it("refuses invalid input and saves nothing", async () => {
    await expect(store.addLog(logOf(interstellar, { rating: 6 }))).rejects.toThrow("between 0.5 and 5");
    expect(await store.getLogsForUser("user-1")).toEqual([]);
  });

  it("caches each movie only once, even across users and rewatches", async () => {
    const first = await store.addLog(logOf(interstellar));
    const rewatch = await store.addLog(logOf(interstellar, { rewatch: true }));
    currentUser = "user-2";
    const someoneElse = await store.addLog(logOf(interstellar));

    expect(rewatch.media.id).toBe(first.media.id);
    expect(someoneElse.media.id).toBe(first.media.id);
    const saved = JSON.parse(storage.getItem(MOCK_MEDIA_STORAGE_KEY)!);
    expect(saved.mediaItems).toHaveLength(1);
    expect(saved.logs).toHaveLength(3);
  });

  it("logs every media type from the unified search (anime, manga, book, game...)", async () => {
    const make = (type: MediaResult["type"], source: MediaResult["source"], sourceId: string): MediaResult => ({
      ...result(sourceId, `${type} ${sourceId}`),
      type,
      source,
      totalUnits: type === "book" ? 604 : null,
    });
    await store.addLog(logOf(make("anime", "anilist", "16498")));
    await store.addLog(logOf(make("manga", "anilist", "53390"), { status: "in_progress", rating: null }));
    const book = await store.addLog(logOf(make("book", "openlibrary", "OL893415W")));
    await store.addLog(logOf(make("game", "igdb", "1942"), { status: "planned", rating: null }));
    // TMDB numbers movies and series separately: movie 550 and series 550 are two items.
    await store.addLog(logOf(make("movie", "tmdb", "550")));
    await store.addLog(logOf(make("series", "tmdb", "550")));

    expect(book.media).toMatchObject({ type: "book", source: "openlibrary", source_id: "OL893415W", total_units: 604 });
    const logs = await store.getLogsForUser("user-1");
    expect(logs.map((l) => l.media.type).sort()).toEqual(["anime", "book", "game", "manga", "movie", "series"]);
    expect(new Set(logs.map((l) => l.media.id)).size).toBe(6);
  });
});

describe("demo media store: reading logs", () => {
  it("returns only that user's logs, newest first", async () => {
    await store.addLog(logOf(interstellar));
    await store.addLog(logOf(parasite));
    currentUser = "user-2";
    await store.addLog(logOf(parasite, { rating: 2 }));

    const mine = await store.getLogsForUser("user-1");
    expect(mine.map((l) => l.media.title)).toEqual(["Parasite", "Interstellar"]);
    expect((await store.getLogsForUser("user-2")).map((l) => l.rating)).toEqual([2]);
    expect(await store.getLogsForUser("nobody")).toEqual([]);
  });

  it("keeps the newest first even when two logs have the same time", async () => {
    clock = 0;
    const sameTime = createMockMediaStore({
      storage,
      getCurrentUserId: async () => "user-1",
      now: () => new Date(Date.UTC(2026, 10, 5)), // frozen clock
    });
    await sameTime.addLog(logOf(interstellar));
    await sameTime.addLog(logOf(parasite));
    expect((await sameTime.getLogsForUser("user-1")).map((l) => l.media.title)).toEqual(["Parasite", "Interstellar"]);
  });

  it("keeps logs after a page reload (a new store on the same storage)", async () => {
    await store.addLog(logOf(interstellar));
    const afterReload = makeStore();
    expect((await afterReload.getLogsForUser("user-1")).map((l) => l.media.title)).toEqual(["Interstellar"]);
  });

  it("starts fresh instead of crashing if the saved data is broken", async () => {
    storage.setItem(MOCK_MEDIA_STORAGE_KEY, "{not json");
    expect(await store.getLogsForUser("user-1")).toEqual([]);
    await store.addLog(logOf(interstellar));
    expect(await store.getLogsForUser("user-1")).toHaveLength(1);
  });

  it("doesn't touch the demo accounts' storage key", async () => {
    await store.addLog(logOf(interstellar));
    expect(storage.getItem("media-log:mock-db")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Stage 4: item page + progress tracker
// ---------------------------------------------------------------------------
const frieren: MediaResult = {
  ...result("154587", "Frieren"),
  type: "anime",
  source: "anilist",
  year: 2023,
  totalUnits: 28,
};

describe("demo media store: item page", () => {
  it("finds the cached item by type, source and source id", async () => {
    const log = await store.addLog(logOf(frieren, { status: "in_progress", rating: null, progress: 3 }));
    expect(await store.getMediaItem({ type: "anime", source: "anilist", sourceId: "154587" })).toEqual(log.media);
    // Same id but another type or source: a different item, never logged.
    expect(await store.getMediaItem({ type: "manga", source: "anilist", sourceId: "154587" })).toBeNull();
    expect(await store.getMediaItem({ type: "anime", source: "tmdb", sourceId: "154587" })).toBeNull();
  });

  it("returns everyone's logs of an item, newest first, and nothing else", async () => {
    const mine = await store.addLog(logOf(interstellar, { rating: 4 }));
    await store.addLog(logOf(parasite));
    currentUser = "user-2";
    await store.addLog(logOf(interstellar, { rating: 5 }));

    const logs = await store.getLogsForItem(mine.media.id);
    expect(logs.map((l) => [l.user_id, l.rating])).toEqual([
      ["user-2", 5],
      ["user-1", 4],
    ]);
    expect(await store.getLogsForItem("no-such-item")).toEqual([]);
  });

  it("saves progress from the log form", async () => {
    const log = await store.addLog(logOf(frieren, { status: "in_progress", rating: null, progress: 7 }));
    expect(log).toMatchObject({ progress: 7, progress_unit: "episode" });
  });

  it("reads logs saved before Stage 4 (no progress_unit) as 'no unit'", async () => {
    await store.addLog(logOf(interstellar));
    const saved = JSON.parse(storage.getItem(MOCK_MEDIA_STORAGE_KEY)!);
    delete saved.logs[0].progress_unit; // what an older save looks like
    storage.setItem(MOCK_MEDIA_STORAGE_KEY, JSON.stringify(saved));
    const [log] = await store.getLogsForUser("user-1");
    expect(log.progress_unit).toBeNull();
  });
});

describe("demo media store: updating progress", () => {
  it("updates your own log and keeps it after a reload", async () => {
    const log = await store.addLog(logOf(frieren, { status: "in_progress", rating: null, progress: 7 }));
    const updated = await store.updateLog(log.id, { status: "in_progress", progress: 8, progressUnit: "episode" });
    expect(updated).toMatchObject({ id: log.id, progress: 8, media: { title: "Frieren" } });

    const [afterReload] = await makeStore().getLogsForUser("user-1");
    expect(afterReload.progress).toBe(8);
  });

  it("finishes the log (today, local time) at the last episode", async () => {
    const log = await store.addLog(logOf(frieren, { status: "in_progress", rating: null, progress: 27 }));
    const updated = await store.updateLog(log.id, { status: "in_progress", progress: 28, progressUnit: "episode" });
    expect(updated.status).toBe("completed");
    // The test clock says Nov 5 2026 at 12:0x UTC, the same day in every time zone near Quebec.
    expect(updated.finished_at).toBe("2026-11-05");
  });

  it("refuses to change someone else's log, or when logged out", async () => {
    const log = await store.addLog(logOf(frieren, { status: "in_progress", rating: null, progress: 1 }));
    currentUser = "user-2";
    await expect(store.updateLog(log.id, { status: "in_progress", progress: 2, progressUnit: null })).rejects.toThrow(
      "your own logs",
    );
    currentUser = null;
    await expect(store.updateLog(log.id, { status: "in_progress", progress: 2, progressUnit: null })).rejects.toThrow(
      "logged in",
    );
    currentUser = "user-1";
    expect((await store.getLogsForUser("user-1"))[0].progress).toBe(1);
  });

  it("refuses bad values and a missing log, and saves nothing", async () => {
    const log = await store.addLog(logOf(frieren, { status: "in_progress", rating: null, progress: 1 }));
    await expect(store.updateLog(log.id, { status: "in_progress", progress: 29, progressUnit: "episode" })).rejects.toThrow(
      "only has 28 episodes",
    );
    await expect(store.updateLog("nope", { status: "in_progress", progress: 2, progressUnit: null })).rejects.toThrow(
      "doesn't exist",
    );
    expect((await store.getLogsForUser("user-1"))[0].progress).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Stage 6: genres and the recommendation pool
// ---------------------------------------------------------------------------

describe("demo media store: genres and listMediaItems", () => {
  it("caches an item's genres with it", async () => {
    const log = await store.addLog(logOf({ ...interstellar, genres: ["Science Fiction", "Drama"] }));
    expect(log.media.genres).toEqual(["Science Fiction", "Drama"]);
    expect((await makeStore().getLogsForUser("user-1"))[0].media.genres).toEqual(["Science Fiction", "Drama"]);
  });

  it("gives items saved before Stage 6 an empty genre list", async () => {
    await store.addLog(logOf(interstellar));
    const saved = JSON.parse(storage.getItem(MOCK_MEDIA_STORAGE_KEY)!);
    delete saved.mediaItems[0].genres; // what an old save looks like
    storage.setItem(MOCK_MEDIA_STORAGE_KEY, JSON.stringify(saved));
    expect((await store.getLogsForUser("user-1"))[0].media.genres).toEqual([]);
  });

  it("lists every cached item, newest first, even signed out", async () => {
    await store.addLog(logOf(interstellar));
    await store.addLog(logOf(parasite));
    await store.addLog(logOf(interstellar)); // same item again: still one
    currentUser = null;
    expect((await store.listMediaItems()).map((item) => item.title)).toEqual(["Parasite", "Interstellar"]);
  });
});
