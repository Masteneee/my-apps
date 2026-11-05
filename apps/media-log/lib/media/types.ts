// The shapes of media data, and the "contract" every media store must follow.
// Same idea as lib/auth/types.ts: pages only talk to `MediaStore`, so the
// localStorage demo store and the Supabase store are interchangeable.

// `as const` makes TypeScript remember the exact strings, so we can build a
// type from the list below ("movie" | "series" | ...) AND loop over it at runtime.
// KEEP IN SYNC with the `check` constraints in supabase/migrations/*_media_logs_lists_follows.sql.
export const MEDIA_TYPES = ["movie", "series", "anime", "manga", "book", "game"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_SOURCES = ["tmdb", "anilist", "openlibrary", "igdb"] as const;
export type MediaSource = (typeof MEDIA_SOURCES)[number];

export const LOG_STATUSES = ["planned", "in_progress", "completed", "dropped", "paused"] as const;
export type LogStatus = (typeof LOG_STATUSES)[number];

/**
 * One search result, BEFORE anyone logs it (nothing is saved yet).
 * camelCase because it's our own app type, not a database row.
 * Stage 3 will convert every source (TMDB, AniList, ...) into this one shape.
 */
export type MediaResult = {
  type: MediaType;
  source: MediaSource;
  sourceId: string; // the source's own id, as text (TMDB uses numbers, others don't)
  title: string;
  originalTitle: string | null; // e.g. "千と千尋の神隠し" for Spirited Away; null if same as title
  year: number | null;
  coverUrl: string | null;
  creators: string[];
  totalUnits: number | null;
  overview: string | null; // short description, shown in search only (not stored)
};

/** One row of `media_items`: a cached copy of a result, made when someone logs it. */
export type MediaItem = {
  id: string;
  type: MediaType;
  source: MediaSource;
  source_id: string;
  title: string;
  year: number | null;
  cover_url: string | null;
  creators: string[];
  total_units: number | null;
  cached_at: string; // ISO date-time
};

/** One row of `logs`. */
export type Log = {
  id: string;
  user_id: string;
  media_item_id: string;
  status: LogStatus;
  rating: number | null; // 0.5 to 5 in half steps, null = not rated
  progress: number | null; // used from Stage 4 (episodes, chapters...)
  review_text: string | null;
  started_at: string | null; // "YYYY-MM-DD"
  finished_at: string | null; // "YYYY-MM-DD"
  rewatch: boolean;
  created_at: string; // ISO date-time
};

/** A log together with the item it is about (what the profile grid needs). */
export type LogWithMedia = Log & { media: MediaItem };

/** What the "log this movie" form sends. Checked by validateLogInput(). */
export type NewLogInput = {
  media: MediaResult;
  status: LogStatus;
  rating: number | null;
  reviewText: string;
  finishedAt: string | null; // "YYYY-MM-DD" or null
  rewatch: boolean;
};

export type MediaStoreMode = "supabase" | "mock";

export interface MediaStore {
  readonly mode: MediaStoreMode;

  /**
   * Saves a log for the signed-in user. Caches the media item first if it's
   * the first time anyone logs it. Throws a friendly Error on failure.
   */
  addLog(input: NewLogInput): Promise<LogWithMedia>;

  /** Everything a user logged, newest first. */
  getLogsForUser(userId: string): Promise<LogWithMedia[]>;
}
