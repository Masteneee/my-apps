import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStorage, createMockAuthService, type KeyValueStorage } from "../auth/mock";
import type { AuthService } from "../auth/types";
import { createMockMediaStore } from "../media/mock";
import type { MediaStore } from "../media/types";
import { mediaItemFields } from "../media/validation";
import { convertAniListResponse } from "../sources/anilist";
import { convertIgdbResponse } from "../sources/igdb";
import { convertOpenLibraryResponse } from "../sources/openlibrary";
import aniListSample from "../sources/samples/anilist-search.json";
import igdbSample from "../sources/samples/igdb-games.json";
import openLibrarySample from "../sources/samples/openlibrary-search.json";
import tmdbMovieSample from "../sources/samples/tmdb-search-movie.json";
import tmdbTvSample from "../sources/samples/tmdb-search-tv.json";
import { convertTmdbMovieResponse, convertTmdbTvResponse } from "../sources/tmdb";
import { DEMO_ITEMS, DEMO_PASSWORD, DEMO_PEOPLE, hasDemoPeople, seedDemoPeople } from "./seed";

const NOW = new Date(Date.UTC(2026, 10, 5, 12, 0));

let storage: KeyValueStorage;
let auth: AuthService;
let store: MediaStore;

beforeEach(() => {
  storage = createMemoryStorage();
  auth = createMockAuthService(storage);
  // Wired like lib/media/index.ts: the store asks the demo auth who is signed in and for profiles.
  store = createMockMediaStore({
    storage,
    getCurrentUserId: async () => (await auth.getCurrentUser())?.id ?? null,
    getProfile: (id) => auth.getProfileForUser(id),
    now: () => NOW,
  });
});

describe("seedDemoPeople", () => {
  it("adds three clearly labeled demo people with profiles", async () => {
    expect(hasDemoPeople(storage)).toBe(false);
    expect(seedDemoPeople(storage, NOW)).toBe(true);
    expect(hasDemoPeople(storage)).toBe(true);

    for (const person of DEMO_PEOPLE) {
      const profile = await auth.getProfileByUsername(person.username);
      expect(profile?.username).toMatch(/^demo_/);
      expect(profile?.display_name).toContain("(demo)");
      expect(profile?.bio).toContain("not a real person");
    }
  });

  it("does nothing the second time", () => {
    seedDemoPeople(storage, NOW);
    expect(seedDemoPeople(storage, NOW)).toBe(false);
  });

  it("keeps your own account, login and logs", async () => {
    await auth.signUp("me@example.com", "secret1");
    await auth.createProfile({ username: "filmfan" });
    const mine = await store.addLog({
      media: { ...convertTmdbMovieResponse(tmdbMovieSample)[0] }, // Interstellar, as search returns it
      status: "completed",
      rating: 4,
      reviewText: "",
      finishedAt: null,
      rewatch: false,
    });

    seedDemoPeople(storage, NOW);

    expect((await auth.getCurrentUser())?.email).toBe("me@example.com");
    expect(await store.getLogsForUser(mine.user_id)).toHaveLength(1);
    // Leo's Interstellar log points to the SAME cached item as mine.
    const leo = await auth.getProfileByUsername("demo_leo");
    const leoLogs = await store.getLogsForUser(leo!.id);
    expect(leoLogs.find((log) => log.media.title === "Interstellar")?.media_item_id).toBe(mine.media_item_id);
  });

  it("gives the feed something to show once you follow them", async () => {
    await auth.signUp("me@example.com", "secret1");
    await auth.createProfile({ username: "filmfan" });
    seedDemoPeople(storage, NOW);

    await store.follow("demo-user-aiko");
    const feed = await store.getFeed();
    expect(feed.length).toBeGreaterThan(0);
    expect(feed.every((entry) => entry.author.username === "demo_aiko")).toBe(true);
    // Aiko's Frieren review was liked by Leo and Sam.
    expect(feed[0]).toMatchObject({ likeCount: 2, likedByMe: false });

    // ...and you can like it too.
    await store.likeReview(feed[0].id);
    expect((await store.getFeed())[0]).toMatchObject({ likeCount: 3, likedByMe: true });
  });

  it("adds Aiko's public list in order", async () => {
    seedDemoPeople(storage, NOW);
    const [list] = await store.getListsForUser("demo-user-aiko");
    expect(list.title).toBe("Best anime for people who don't watch anime");
    expect(list.items.map((item) => item.media.title)).toEqual([
      "Spirited Away",
      "Cowboy Bebop",
      "Frieren: Beyond Journey’s End",
      "Planetes",
      "Fullmetal Alchemist: Brotherhood",
    ]);
  });

  it("lets you log in as a demo person", async () => {
    seedDemoPeople(storage, NOW);
    const user = await auth.signIn(DEMO_PEOPLE[1].email, DEMO_PASSWORD);
    expect(user.id).toBe(DEMO_PEOPLE[1].id);
  });

  it("refuses if a real account already took a demo username", async () => {
    await auth.signUp("me@example.com", "secret1");
    await auth.createProfile({ username: "demo_leo" });
    expect(() => seedDemoPeople(storage, NOW)).toThrow("demo_leo");
    expect(hasDemoPeople(storage)).toBe(false); // nothing half-added
  });
});

describe("demo items", () => {
  it("are exactly what search returns for them (from the saved samples)", () => {
    // If someone edits a sample file, this test says which demo item to update.
    const fromSamples = [
      ...convertTmdbMovieResponse(tmdbMovieSample),
      ...convertTmdbTvResponse(tmdbTvSample),
      ...convertAniListResponse(aniListSample),
      ...convertOpenLibraryResponse(openLibrarySample),
      ...convertIgdbResponse(igdbSample),
    ].map(mediaItemFields);

    for (const item of Object.values(DEMO_ITEMS)) {
      const match = fromSamples.find(
        (s) => s.source === item.source && s.type === item.type && s.source_id === item.source_id,
      );
      expect(match, `${item.title} should be in the samples`).toEqual(item);
    }
  });
});
