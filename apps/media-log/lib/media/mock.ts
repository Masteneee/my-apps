// A FAKE media store that keeps media items and logs in the browser's
// localStorage, used in demo mode (no Supabase keys). It follows the same
// `MediaStore` contract as the real Supabase store in ./supabase.ts.
//
// It's saved under its own key, separate from the demo accounts
// (media-log:mock-db), so each file only knows about its own data.

import type { KeyValueStorage } from "../auth/mock";
import type { Log, LogWithMedia, MediaItem, MediaStore, NewLogInput } from "./types";
import { localToday, mediaItemFields, planLogUpdate, validateLogInput } from "./validation";

export const MOCK_MEDIA_STORAGE_KEY = "media-log:mock-media";

type MockMediaDatabase = {
  mediaItems: MediaItem[];
  logs: Log[];
};

const emptyDatabase = (): MockMediaDatabase => ({ mediaItems: [], logs: [] });

export type MockMediaStoreOptions = {
  storage: KeyValueStorage;
  /** Who is signed in (the demo auth knows). Null = nobody. */
  getCurrentUserId: () => Promise<string | null>;
  /** How new ids are made. Tests pass a predictable one. */
  makeId?: () => string;
  /** The current time. Tests pass a fixed one. */
  now?: () => Date;
};

export function createMockMediaStore({
  storage,
  getCurrentUserId,
  makeId = () => crypto.randomUUID(),
  now = () => new Date(),
}: MockMediaStoreOptions): MediaStore {
  function load(): MockMediaDatabase {
    const raw = storage.getItem(MOCK_MEDIA_STORAGE_KEY);
    if (!raw) return emptyDatabase();
    try {
      const parsed = JSON.parse(raw) as Partial<MockMediaDatabase>;
      // `?? []` in case an older or hand-edited save is missing a part.
      // Logs saved before Stage 4 have no `progress_unit`: give them null, like
      // the database does for old rows when the new column is added.
      const logs = (parsed.logs ?? []).map((log) => ({ ...log, progress_unit: log.progress_unit ?? null }));
      return { mediaItems: parsed.mediaItems ?? [], logs };
    } catch {
      // Corrupted data: start over instead of crashing (same as the demo auth).
      return emptyDatabase();
    }
  }

  function save(db: MockMediaDatabase) {
    storage.setItem(MOCK_MEDIA_STORAGE_KEY, JSON.stringify(db));
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
      const fields = mediaItemFields(input.media);

      // Reuse the cached copy if anyone already logged this item (the database
      // has the same "unique (source, type, source_id)" rule). Otherwise cache it.
      let media = db.mediaItems.find(
        (item) => item.source === fields.source && item.type === fields.type && item.source_id === fields.source_id,
      );
      if (!media) {
        media = { id: makeId(), ...fields, cached_at: now().toISOString() };
        db.mediaItems.push(media);
      }

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
  };
}
