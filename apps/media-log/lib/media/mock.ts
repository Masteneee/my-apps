// A FAKE media store that keeps media items and logs in the browser's
// localStorage, used in demo mode (no Supabase keys). It follows the same
// `MediaStore` contract as the real Supabase store in ./supabase.ts.
//
// It's saved under its own key, separate from the demo accounts
// (media-log:mock-db), so each file only knows about its own data.

import type { KeyValueStorage } from "../auth/mock";
import type { Log, LogWithMedia, MediaItem, MediaStore, NewLogInput } from "./types";
import { localToday, mediaItemFields, validateLogInput } from "./validation";

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
      return { mediaItems: parsed.mediaItems ?? [], logs: parsed.logs ?? [] };
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
        progress: null,
        started_at: null,
        created_at: now().toISOString(),
      };
      db.logs.push(log);
      save(db);
      return { ...log, media };
    },

    async getLogsForUser(userId) {
      const db = load();
      return (
        db.logs
          .filter((log) => log.user_id === userId)
          // New logs are pushed at the end, so reversing puts the newest first.
          // The sort then fixes any order problems; for equal times it keeps
          // the reversed order (JavaScript's sort is "stable").
          .reverse()
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map((log) => withMedia(db, log))
          // Skip logs whose item is missing (only possible with hand-edited data).
          .filter((log): log is LogWithMedia => log !== null)
      );
    },
  };
}
