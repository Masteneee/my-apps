// Tests for the Stage 5 methods of the demo store: follows, feed, review
// likes and lists. (mock.test.ts covers the logs from Stages 2 to 4.)
import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStorage, type KeyValueStorage } from "../auth/mock";
import { createMockMediaStore, MOCK_MEDIA_STORAGE_KEY } from "./mock";
import type { MediaResult, MediaStore, NewLogInput, PublicProfile } from "./types";

function movie(sourceId: string, title: string): MediaResult {
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
const interstellar = movie("157336", "Interstellar");
const parasite = movie("496243", "Parasite");
const arrival = movie("329865", "Arrival");

function logOf(media: MediaResult, extra: Partial<NewLogInput> = {}): NewLogInput {
  return { media, status: "completed", rating: 4, reviewText: "", finishedAt: null, rewatch: false, ...extra };
}

// Three known people. "ghost" has no profile.
const PROFILES: Record<string, PublicProfile> = {
  ana: { id: "ana", username: "ana", display_name: "Ana", avatar_url: null },
  ben: { id: "ben", username: "ben", display_name: null, avatar_url: null },
  me: { id: "me", username: "me", display_name: null, avatar_url: null },
};

let storage: KeyValueStorage;
let currentUser: string | null;
let clock: number;
let store: MediaStore;

beforeEach(() => {
  storage = createMemoryStorage();
  currentUser = "me";
  clock = 0;
  let n = 0;
  store = createMockMediaStore({
    storage,
    getCurrentUserId: async () => currentUser,
    makeId: () => `id-${++n}`,
    now: () => new Date(Date.UTC(2026, 10, 5, 12, clock++)),
    getProfile: async (id) => PROFILES[id] ?? null,
  });
});

/** Log something as `user`, then switch back to "me". */
async function logAs(user: string, input: NewLogInput) {
  currentUser = user;
  const log = await store.addLog(input);
  currentUser = "me";
  return log;
}

describe("demo store: follows", () => {
  it("follows and unfollows", async () => {
    await store.follow("ana");
    await store.follow("ana"); // twice changes nothing
    expect(await store.getFollowing("me")).toEqual(["ana"]);
    expect(await store.getFollowers("ana")).toEqual(["me"]);

    await store.unfollow("ana");
    expect(await store.getFollowing("me")).toEqual([]);
    expect(await store.getFollowers("ana")).toEqual([]);
  });

  it("refuses to follow yourself, someone who doesn't exist, or when signed out", async () => {
    await expect(store.follow("me")).rejects.toThrow("yourself");
    await expect(store.follow("ghost")).rejects.toThrow("doesn't exist");
    currentUser = null;
    await expect(store.follow("ana")).rejects.toThrow("logged in");
  });
});

describe("demo store: feed", () => {
  it("shows what the people I follow logged, newest first, with authors", async () => {
    await logAs("ana", logOf(interstellar));
    await logAs("ben", logOf(parasite));
    await store.addLog(logOf(arrival)); // my own: not in my feed
    await logAs("ana", logOf(arrival, { reviewText: "Wow" }));

    expect(await store.getFeed()).toEqual([]); // following nobody yet

    await store.follow("ana");
    const feed = await store.getFeed();
    expect(feed.map((entry) => [entry.author.username, entry.media.title])).toEqual([
      ["ana", "Arrival"],
      ["ana", "Interstellar"],
    ]);

    await store.follow("ben");
    expect((await store.getFeed()).map((entry) => entry.media.title)).toEqual(["Arrival", "Parasite", "Interstellar"]);
  });

  it("is empty when signed out", async () => {
    currentUser = null;
    expect(await store.getFeed()).toEqual([]);
  });
});

describe("demo store: review likes", () => {
  it("likes and unlikes someone's review, and the counts follow", async () => {
    const review = await logAs("ana", logOf(interstellar, { reviewText: "Great" }));
    await store.likeReview(review.id);
    await store.likeReview(review.id); // twice = still one like
    currentUser = "ben";
    await store.likeReview(review.id);
    currentUser = "me";

    let [shown] = await store.getReviewsForItem(review.media_item_id);
    expect(shown).toMatchObject({ id: review.id, likeCount: 2, likedByMe: true, author: { username: "ana" } });

    await store.unlikeReview(review.id);
    [shown] = await store.getReviewsForItem(review.media_item_id);
    expect(shown).toMatchObject({ likeCount: 1, likedByMe: false });
  });

  it("refuses your own review and logs without a review", async () => {
    const mine = await store.addLog(logOf(interstellar, { reviewText: "Mine" }));
    await expect(store.likeReview(mine.id)).rejects.toThrow("your own");
    const noReview = await logAs("ana", logOf(parasite));
    await expect(store.likeReview(noReview.id)).rejects.toThrow("no review");
    await expect(store.likeReview("nope")).rejects.toThrow("doesn't exist");
  });

  it("only lists logs with a review on the item page", async () => {
    const withReview = await logAs("ana", logOf(interstellar, { reviewText: "Great" }));
    await logAs("ben", logOf(interstellar)); // stars only
    const reviews = await store.getReviewsForItem(withReview.media_item_id);
    expect(reviews.map((r) => r.id)).toEqual([withReview.id]);
  });

  it("shows likes in the feed too", async () => {
    const review = await logAs("ana", logOf(interstellar, { reviewText: "Great" }));
    await store.follow("ana");
    await store.likeReview(review.id);
    expect((await store.getFeed())[0]).toMatchObject({ likeCount: 1, likedByMe: true });
  });
});

describe("demo store: lists", () => {
  it("creates a list and adds items at the end", async () => {
    const list = await store.createList({ title: " Best sci-fi ", description: "", isPublic: true });
    expect(list).toMatchObject({ user_id: "me", title: "Best sci-fi", description: null, is_public: true });

    await store.addToList(list.id, interstellar);
    const full = await store.addToList(list.id, arrival);
    expect(full.items.map((i) => [i.media.title, i.position])).toEqual([
      ["Interstellar", 0],
      ["Arrival", 1],
    ]);
    expect(full.author.username).toBe("me");
    await expect(store.addToList(list.id, arrival)).rejects.toThrow("already in this list");
  });

  it("reuses the cached item when it was already logged", async () => {
    const logged = await store.addLog(logOf(interstellar));
    const list = await store.createList({ title: "Faves", description: "", isPublic: true });
    const full = await store.addToList(list.id, interstellar);
    expect(full.items[0].media_item_id).toBe(logged.media_item_id);
  });

  it("refuses a list without a title", async () => {
    await expect(store.createList({ title: "  ", description: "", isPublic: true })).rejects.toThrow("title");
  });

  it("reorders, removes and deletes", async () => {
    const list = await store.createList({ title: "Order", description: "", isPublic: true });
    await store.addToList(list.id, interstellar);
    await store.addToList(list.id, parasite);
    const three = await store.addToList(list.id, arrival);
    const [a, b, c] = three.items.map((i) => i.media_item_id);

    const reordered = await store.reorderList(list.id, [c, a, b]);
    expect(reordered.items.map((i) => i.media.title)).toEqual(["Arrival", "Interstellar", "Parasite"]);
    // Missing an item = refused, nothing changes.
    await expect(store.reorderList(list.id, [a, b])).rejects.toThrow("changed somewhere else");

    const removed = await store.removeFromList(list.id, a);
    expect(removed.items.map((i) => i.media.title)).toEqual(["Arrival", "Parasite"]);

    await store.deleteList(list.id);
    expect(await store.getList(list.id)).toBeNull();
    // Its items went too ("on delete cascade").
    const saved = JSON.parse(storage.getItem(MOCK_MEDIA_STORAGE_KEY)!);
    expect(saved.listItems).toEqual([]);
  });

  it("lets only the owner change a list", async () => {
    currentUser = "ana";
    const list = await store.createList({ title: "Ana's", description: "", isPublic: true });
    currentUser = "me";
    await expect(store.addToList(list.id, interstellar)).rejects.toThrow("your own lists");
    await expect(store.reorderList(list.id, [])).rejects.toThrow("your own lists");
    await expect(store.deleteList(list.id)).rejects.toThrow("your own lists");
    await expect(store.deleteList("nope")).rejects.toThrow("doesn't exist");
  });

  it("hides private lists from everyone but the owner", async () => {
    currentUser = "ana";
    const open = await store.createList({ title: "Open", description: "", isPublic: true });
    const secret = await store.createList({ title: "Secret", description: "", isPublic: false });

    expect((await store.getListsForUser("ana")).map((l) => l.title)).toEqual(["Secret", "Open"]); // owner: both, newest first
    currentUser = "me";
    expect((await store.getListsForUser("ana")).map((l) => l.title)).toEqual(["Open"]);
    expect(await store.getList(secret.id)).toBeNull();
    expect((await store.getList(open.id))?.title).toBe("Open");
    currentUser = null; // signed out visitors see public lists too
    expect((await store.getList(open.id))?.title).toBe("Open");
  });
});

describe("demo store: older saves", () => {
  it("loads a save from before Stage 5 (no follows, likes or lists yet)", async () => {
    storage.setItem(MOCK_MEDIA_STORAGE_KEY, JSON.stringify({ mediaItems: [], logs: [] }));
    expect(await store.getFollowing("me")).toEqual([]);
    expect(await store.getListsForUser("me")).toEqual([]);
    await store.follow("ana");
    expect(await store.getFollowing("me")).toEqual(["ana"]);
  });
});
