// A FAKE media store that keeps media items and logs in the browser's
// localStorage, used in demo mode (no Supabase keys). It follows the same
// `MediaStore` contract as the real Supabase store in ./supabase.ts.
//
// It's saved under its own key, separate from the demo accounts
// (media-log:mock-db), so each file only knows about its own data.

import type { KeyValueStorage } from "../auth/mock";
import { attachSocial, buildFeed, hasReview, likeProblem, newestFirst } from "./feed";
import { validateListInput } from "./lists";
import { nextPosition, positionChanges, sortByPosition } from "./reorder";
import {
  MEDIA_POOL_LIMIT,
  type ListItem,
  type ListWithItems,
  type Log,
  type LogWithMedia,
  type MediaItem,
  type MediaList,
  type MediaResult,
  type MediaStore,
  type NewLogInput,
  type PublicProfile,
  type ReviewLike,
} from "./types";
import { localToday, mediaItemFields, planLogUpdate, validateLogInput } from "./validation";

export const MOCK_MEDIA_STORAGE_KEY = "media-log:mock-media";

/** One row of `follows`. */
export type MockFollow = { follower_id: string; following_id: string; created_at: string };

// Exported so the demo people seed (lib/demo/seed.ts) can add rows to it.
export type MockMediaDatabase = {
  mediaItems: MediaItem[];
  logs: Log[];
  // Stage 5. Saves from before Stage 5 don't have these: load() fills in [].
  follows: MockFollow[];
  likes: (ReviewLike & { created_at: string })[];
  lists: MediaList[];
  listItems: ListItem[];
};

const emptyDatabase = (): MockMediaDatabase => ({
  mediaItems: [],
  logs: [],
  follows: [],
  likes: [],
  lists: [],
  listItems: [],
});

/** Reads the saved demo data, filling in anything missing. Exported for the seed. */
export function loadMockMediaDatabase(storage: KeyValueStorage): MockMediaDatabase {
  const raw = storage.getItem(MOCK_MEDIA_STORAGE_KEY);
  if (!raw) return emptyDatabase();
  try {
    const parsed = JSON.parse(raw) as Partial<MockMediaDatabase>;
    // `?? []` in case an older or hand-edited save is missing a part.
    // Logs saved before Stage 4 have no `progress_unit`: give them null, like
    // the database does for old rows when the new column is added.
    const logs = (parsed.logs ?? []).map((log) => ({ ...log, progress_unit: log.progress_unit ?? null }));
    // Items cached before Stage 6 have no `genres`: give them [] ("unknown"),
    // like the database's default '{}' for old rows when the column is added.
    const mediaItems = (parsed.mediaItems ?? []).map((item) => ({ ...item, genres: item.genres ?? [] }));
    return {
      mediaItems,
      logs,
      follows: parsed.follows ?? [],
      likes: parsed.likes ?? [],
      lists: parsed.lists ?? [],
      listItems: parsed.listItems ?? [],
    };
  } catch {
    // Corrupted data: start over instead of crashing (same as the demo auth).
    return emptyDatabase();
  }
}

export function saveMockMediaDatabase(storage: KeyValueStorage, db: MockMediaDatabase) {
  storage.setItem(MOCK_MEDIA_STORAGE_KEY, JSON.stringify(db));
}

export type MockMediaStoreOptions = {
  storage: KeyValueStorage;
  /** Who is signed in (the demo auth knows). Null = nobody. */
  getCurrentUserId: () => Promise<string | null>;
  /** How new ids are made. Tests pass a predictable one. */
  makeId?: () => string;
  /** The current time. Tests pass a fixed one. */
  now?: () => Date;
  /**
   * Looks up someone's public profile (Stage 5: names on the feed, reviews and
   * lists). Profiles live in the demo AUTH data, so lib/media/index.ts passes
   * the auth service. Tests can leave it out: everyone is then "@<their id>".
   */
  getProfile?: (userId: string) => Promise<PublicProfile | null>;
};

export function createMockMediaStore({
  storage,
  getCurrentUserId,
  makeId = () => crypto.randomUUID(),
  now = () => new Date(),
  getProfile = async (userId) => ({ id: userId, username: userId, display_name: null, avatar_url: null }),
}: MockMediaStoreOptions): MediaStore {
  const load = () => loadMockMediaDatabase(storage);
  const save = (db: MockMediaDatabase) => saveMockMediaDatabase(storage, db);

  /** Who is signed in, or a friendly error (mirrors "RLS: only logged-in users can write"). */
  async function requireUser(action: string): Promise<string> {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error(`You need to be logged in to ${action}.`);
    return userId;
  }

  /** Reuse the cached copy of an item, or cache it now (same rule as the database's unique key). */
  function findOrCreateMediaItem(db: MockMediaDatabase, result: MediaResult): MediaItem {
    const fields = mediaItemFields(result);
    let media = db.mediaItems.find(
      (item) => item.source === fields.source && item.type === fields.type && item.source_id === fields.source_id,
    );
    if (!media) {
      media = { id: makeId(), ...fields, cached_at: now().toISOString() };
      db.mediaItems.push(media);
    }
    return media;
  }

  /** The profiles of these users (each looked up once), skipping unknown ones. */
  async function profilesFor(userIds: string[]): Promise<PublicProfile[]> {
    const unique = [...new Set(userIds)];
    const found = await Promise.all(unique.map((id) => getProfile(id)));
    return found.filter((profile): profile is PublicProfile => profile !== null);
  }

  /** Logs + authors + likes, like the Supabase store's "join". */
  async function withSocial(db: MockMediaDatabase, logs: LogWithMedia[]) {
    const me = await getCurrentUserId();
    const ids = new Set(logs.map((log) => log.id));
    const likes = db.likes.filter((like) => ids.has(like.log_id));
    return attachSocial(logs, await profilesFor(logs.map((log) => log.user_id)), likes, me);
  }

  /**
   * A list with its owner and sorted items, or null if `viewer` may not see it.
   * Mirrors the RLS rule: public lists for everyone, private ones only for the owner.
   */
  async function listWithItems(db: MockMediaDatabase, list: MediaList, viewer: string | null): Promise<ListWithItems | null> {
    if (!list.is_public && list.user_id !== viewer) return null;
    const author = (await getProfile(list.user_id)) ?? {
      id: list.user_id,
      username: "unknown",
      display_name: null,
      avatar_url: null,
    };
    const items = sortByPosition(db.listItems.filter((item) => item.list_id === list.id)).flatMap((item) => {
      const media = db.mediaItems.find((m) => m.id === item.media_item_id);
      return media ? [{ ...item, media }] : []; // skip items whose media is missing (hand-edited data)
    });
    return { ...list, author, items };
  }

  /** Finds one of YOUR lists, or throws a friendly error (mirrors the owner-only RLS policies). */
  function ownList(db: MockMediaDatabase, listId: string, userId: string): MediaList {
    const list = db.lists.find((l) => l.id === listId);
    if (!list) throw new Error("That list doesn't exist anymore. Reload the page.");
    if (list.user_id !== userId) throw new Error("You can only change your own lists.");
    return list;
  }

  async function reloadList(listId: string, viewer: string): Promise<ListWithItems> {
    const db = load();
    const list = db.lists.find((l) => l.id === listId);
    const full = list ? await listWithItems(db, list, viewer) : null;
    if (!full) throw new Error("That list doesn't exist anymore. Reload the page.");
    return full;
  }

  // Attach each log's media item, like a database "join".
  function withMedia(db: MockMediaDatabase, log: Log): LogWithMedia | null {
    const media = db.mediaItems.find((item) => item.id === log.media_item_id);
    return media ? { ...log, media } : null;
  }

  // Newest first, with media attached, skipping logs whose item is missing
  // (only possible with hand-edited data).
  function newestFirstWithMedia(db: MockMediaDatabase, logs: Log[]): LogWithMedia[] {
    return (
      [...logs]
        // New logs are pushed at the end, so reversing puts the newest first.
        // The sort then fixes any order problems; for equal times it keeps
        // the reversed order (JavaScript's sort is "stable").
        .reverse()
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((log) => withMedia(db, log))
        .filter((log): log is LogWithMedia => log !== null)
    );
  }

  return {
    mode: "mock",

    async addLog(input: NewLogInput) {
      const userId = await getCurrentUserId();
      // Mirrors the RLS rule: you can only write logs as yourself, so you must be logged in.
      if (!userId) throw new Error("You need to be logged in to log something.");

      const checked = validateLogInput(input, localToday(now()));
      if (!checked.ok) throw new Error(checked.error);

      const db = load();
      // Reuse the cached copy if anyone already logged this item, otherwise cache it.
      const media = findOrCreateMediaItem(db, input.media);

      const log: Log = {
        id: makeId(),
        user_id: userId,
        media_item_id: media.id,
        ...checked.value,
        started_at: null,
        created_at: now().toISOString(),
      };
      db.logs.push(log);
      save(db);
      return { ...log, media };
    },

    async getLogsForUser(userId) {
      const db = load();
      return newestFirstWithMedia(db, db.logs.filter((log) => log.user_id === userId));
    },

    async getMediaItem({ type, source, sourceId }) {
      const db = load();
      return db.mediaItems.find((item) => item.type === type && item.source === source && item.source_id === sourceId) ?? null;
    },

    async getLogsForItem(mediaItemId) {
      // Everyone's logs: in demo mode "everyone" = every demo account made in this browser.
      const db = load();
      return newestFirstWithMedia(db, db.logs.filter((log) => log.media_item_id === mediaItemId));
    },

    async updateLog(logId, change) {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error("You need to be logged in to change a log.");

      const db = load();
      const index = db.logs.findIndex((log) => log.id === logId);
      const current = index === -1 ? null : withMedia(db, db.logs[index]);
      if (!current) throw new Error("That log doesn't exist anymore. Reload the page.");
      // Mirrors the RLS rule "Users can update their own logs".
      if (current.user_id !== userId) throw new Error("You can only change your own logs.");

      const planned = planLogUpdate(current, change, localToday(now()));
      if (!planned.ok) throw new Error(planned.error);

      const updated: Log = { ...db.logs[index], ...planned.value };
      db.logs[index] = updated;
      save(db);
      return { ...updated, media: current.media };
    },

    // ----- Stage 5: follows -----

    async follow(userId) {
      const me = await requireUser("follow someone");
      // Same rule as the database's check (follower_id <> following_id).
      if (userId === me) throw new Error("You can't follow yourself.");
      // Same as the foreign key: you can only follow someone who exists.
      if (!(await getProfile(userId))) throw new Error("That person doesn't exist anymore.");
      const db = load();
      // The primary key (follower_id, following_id) means "once": a second follow changes nothing.
      if (db.follows.some((f) => f.follower_id === me && f.following_id === userId)) return;
      db.follows.push({ follower_id: me, following_id: userId, created_at: now().toISOString() });
      save(db);
    },

    async unfollow(userId) {
      const me = await requireUser("unfollow someone");
      const db = load();
      db.follows = db.follows.filter((f) => !(f.follower_id === me && f.following_id === userId));
      save(db);
    },

    async getFollowing(userId) {
      return load()
        .follows.filter((f) => f.follower_id === userId)
        .map((f) => f.following_id);
    },

    async getFollowers(userId) {
      return load()
        .follows.filter((f) => f.following_id === userId)
        .map((f) => f.follower_id);
    },

    // ----- Stage 5: feed and review likes -----

    async getFeed() {
      const me = await getCurrentUserId();
      if (!me) return [];
      const db = load();
      const following = db.follows.filter((f) => f.follower_id === me).map((f) => f.following_id);
      // The demo store has every log in memory, so the pure buildFeed does the
      // filtering ("only people I follow"), the sorting and the limit.
      const allLogs = db.logs.map((log) => withMedia(db, log)).filter((log): log is LogWithMedia => log !== null);
      return withSocial(db, buildFeed(allLogs, following));
    },

    async getReviewsForItem(mediaItemId) {
      const db = load();
      const reviews = db.logs.filter((log) => log.media_item_id === mediaItemId && hasReview(log));
      return withSocial(db, newestFirstWithMedia(db, reviews));
    },

    async likeReview(logId) {
      const me = await requireUser("like a review");
      const db = load();
      const log = db.logs.find((l) => l.id === logId);
      if (!log) throw new Error("That review doesn't exist anymore. Reload the page.");
      // The same rules as the database's insert policy on review_likes.
      const problem = likeProblem(log, me);
      if (problem) throw new Error(problem);
      if (db.likes.some((like) => like.user_id === me && like.log_id === logId)) return; // already liked
      db.likes.push({ user_id: me, log_id: logId, created_at: now().toISOString() });
      save(db);
    },

    async unlikeReview(logId) {
      const me = await requireUser("unlike a review");
      const db = load();
      db.likes = db.likes.filter((like) => !(like.user_id === me && like.log_id === logId));
      save(db);
    },

    // ----- Stage 5: lists -----

    async createList(input) {
      const me = await requireUser("make a list");
      const checked = validateListInput(input);
      if (!checked.ok) throw new Error(checked.error);
      const db = load();
      const list: MediaList = { id: makeId(), user_id: me, ...checked.value, created_at: now().toISOString() };
      db.lists.push(list);
      save(db);
      return list;
    },

    async getListsForUser(userId) {
      const db = load();
      const viewer = await getCurrentUserId();
      const lists = newestFirst(db.lists.filter((list) => list.user_id === userId));
      const full = await Promise.all(lists.map((list) => listWithItems(db, list, viewer)));
      return full.filter((list): list is ListWithItems => list !== null); // drops private lists of others
    },

    async getList(listId) {
      const db = load();
      const list = db.lists.find((l) => l.id === listId);
      return list ? listWithItems(db, list, await getCurrentUserId()) : null;
    },

    async deleteList(listId) {
      const me = await requireUser("delete a list");
      const db = load();
      ownList(db, listId, me);
      db.lists = db.lists.filter((l) => l.id !== listId);
      // Like "on delete cascade" in the database: the list's items go too.
      db.listItems = db.listItems.filter((item) => item.list_id !== listId);
      save(db);
    },

    async addToList(listId, media) {
      const me = await requireUser("change a list");
      const db = load();
      ownList(db, listId, me);
      const item = findOrCreateMediaItem(db, media);
      const current = db.listItems.filter((i) => i.list_id === listId);
      // Same as the primary key (list_id, media_item_id): each item once per list.
      if (current.some((i) => i.media_item_id === item.id)) throw new Error("It's already in this list.");
      db.listItems.push({ list_id: listId, media_item_id: item.id, position: nextPosition(current), note: null });
      save(db);
      return reloadList(listId, me);
    },

    async removeFromList(listId, mediaItemId) {
      const me = await requireUser("change a list");
      const db = load();
      ownList(db, listId, me);
      // The other positions keep their numbers (a gap is fine: we only ever SORT by position).
      db.listItems = db.listItems.filter((i) => !(i.list_id === listId && i.media_item_id === mediaItemId));
      save(db);
      return reloadList(listId, me);
    },

    async reorderList(listId, orderedMediaItemIds) {
      const me = await requireUser("change a list");
      const db = load();
      ownList(db, listId, me);
      const current = db.listItems.filter((i) => i.list_id === listId);
      // Throws if the ids don't match the list exactly (missing, extra, twice).
      for (const change of positionChanges(current, orderedMediaItemIds)) {
        const row = db.listItems.find((i) => i.list_id === listId && i.media_item_id === change.media_item_id);
        if (row) row.position = change.position;
      }
      save(db);
      return reloadList(listId, me);
    },

    // ----- Stage 6: recommendations -----

    async listMediaItems() {
      // Newest first: items are pushed at the end, so reverse, then sort by date (stable).
      return [...load().mediaItems]
        .reverse()
        .sort((a, b) => b.cached_at.localeCompare(a.cached_at))
        .slice(0, MEDIA_POOL_LIMIT);
    },
  };
}
