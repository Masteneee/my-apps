// The shapes of media data, and the "contract" every media store must follow.
// Same idea as lib/auth/types.ts: pages only talk to `MediaStore`, so the
// localStorage demo store and the Supabase store are interchangeable.

import type { Profile } from "../auth/types";

// `as const` makes TypeScript remember the exact strings, so we can build a
// type from the list below ("movie" | "series" | ...) AND loop over it at runtime.
// KEEP IN SYNC with the `check` constraints in supabase/migrations/*_media_logs_lists_follows.sql.
export const MEDIA_TYPES = ["movie", "series", "anime", "manga", "book", "game"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_SOURCES = ["tmdb", "anilist", "openlibrary", "igdb"] as const;
export type MediaSource = (typeof MEDIA_SOURCES)[number];

export const LOG_STATUSES = ["planned", "in_progress", "completed", "dropped", "paused"] as const;
export type LogStatus = (typeof LOG_STATUSES)[number];

// What `logs.progress` counts (Stage 4). Each media type allows some of them,
// see progressUnitsFor() in ./progress.ts: episodes for series and anime,
// chapters for manga, pages OR percent for books, hours for games, none for movies.
// KEEP IN SYNC with the `check` on logs.progress_unit in supabase/migrations/*_progress_units.sql.
export const PROGRESS_UNITS = ["episode", "chapter", "page", "percent", "hour"] as const;
export type ProgressUnit = (typeof PROGRESS_UNITS)[number];

/**
 * One search result, BEFORE anyone logs it (nothing is saved yet).
 * camelCase because it's our own app type, not a database row.
 * Every source adapter (lib/sources/: TMDB, AniList, Open Library, IGDB)
 * converts its answers into this one shape.
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
  totalUnits: number | null; // episodes (series, anime), chapters (manga), pages (books)
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
  progress: number | null; // how far you are (Stage 4): 7 episodes, 120 chapters, 45 (%), 12.5 (hours)...
  progress_unit: ProgressUnit | null; // what `progress` counts; null exactly when progress is null
  review_text: string | null;
  started_at: string | null; // "YYYY-MM-DD"
  finished_at: string | null; // "YYYY-MM-DD"
  rewatch: boolean;
  created_at: string; // ISO date-time
};

/** A log together with the item it is about (what the profile grid needs). */
export type LogWithMedia = Log & { media: MediaItem };

/** What the "log this" form sends (for any media type). Checked by validateLogInput(). */
export type NewLogInput = {
  media: MediaResult;
  status: LogStatus;
  rating: number | null;
  reviewText: string;
  finishedAt: string | null; // "YYYY-MM-DD" or null
  rewatch: boolean;
  /** How far you are (Stage 4). Optional so older code and tests can leave it out (= no progress). */
  progress?: number | null;
  /** What `progress` counts. Null/missing = the default unit for the type (e.g. "episode"). */
  progressUnit?: ProgressUnit | null;
};

/**
 * What the progress tracker on the item page sends to change an existing log.
 * Checked (and sometimes adjusted, e.g. 24/24 episodes = "completed") by planLogUpdate().
 */
export type LogUpdateInput = {
  status: LogStatus;
  progress: number | null;
  progressUnit: ProgressUnit | null;
};

/** How the item page URL names an item: /media/anime/anilist-16498 = { type, source, sourceId }. */
export type MediaItemRef = {
  type: MediaType;
  source: MediaSource;
  sourceId: string;
};

// ---------------------------------------------------------------------------
// Stage 5: social (follows, feed, review likes, lists)
// ---------------------------------------------------------------------------

/** The public part of a profile, shown next to someone's log, review or list. */
export type PublicProfile = Pick<Profile, "id" | "username" | "display_name" | "avatar_url">;

/** One row of `review_likes` (Stage 5 migration): "this user liked this review". */
export type ReviewLike = {
  user_id: string;
  log_id: string;
};

/**
 * A log as the feed and the reviews section show it: with its item, WHO wrote
 * it, and its likes. `likeCount` and `likedByMe` are camelCase because they are
 * worked out by our code (attachSocial in ./feed.ts), not columns in the database.
 */
export type SocialLog = LogWithMedia & {
  author: PublicProfile;
  likeCount: number;
  likedByMe: boolean;
};

/** One row of `lists` (Stage 2 migration). */
export type MediaList = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  created_at: string; // ISO date-time
};

/** One row of `list_items`: which item is in which list, at which place (0 = first). */
export type ListItem = {
  list_id: string;
  media_item_id: string;
  position: number;
  note: string | null;
};

export type ListItemWithMedia = ListItem & { media: MediaItem };

/** A list with its owner and its items, already sorted by position. */
export type ListWithItems = MediaList & {
  author: PublicProfile;
  items: ListItemWithMedia[];
};

/** What the "new list" form sends. Checked by validateListInput() in ./lists.ts. */
export type NewListInput = {
  title: string;
  description: string;
  isPublic: boolean;
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

  /** The cached copy of an item, or null if nobody has logged it yet (Stage 4, item page). */
  getMediaItem(ref: MediaItemRef): Promise<MediaItem | null>;

  /** EVERYONE's logs of one item, newest first (for "my log" and the average rating). */
  getLogsForItem(mediaItemId: string): Promise<LogWithMedia[]>;

  /**
   * Changes the status and progress of one of YOUR logs (the progress tracker).
   * Throws a friendly Error if it's not yours or the values are wrong.
   */
  updateLog(logId: string, change: LogUpdateInput): Promise<LogWithMedia>;

  // ----- Stage 5: follows -----

  /** The signed-in user starts following `userId`. Following twice is fine (nothing changes). */
  follow(userId: string): Promise<void>;
  unfollow(userId: string): Promise<void>;
  /** The ids of the people `userId` follows. */
  getFollowing(userId: string): Promise<string[]>;
  /** The ids of the people who follow `userId`. */
  getFollowers(userId: string): Promise<string[]>;

  // ----- Stage 5: feed and review likes -----

  /** What the people YOU follow logged, newest first (at most FEED_LIMIT). Empty when signed out. */
  getFeed(): Promise<SocialLog[]>;
  /** Everyone's logs of an item that have a review, newest first, with likes. */
  getReviewsForItem(mediaItemId: string): Promise<SocialLog[]>;
  /** Like someone else's review. Liking twice is fine. Throws if it's your own or has no review. */
  likeReview(logId: string): Promise<void>;
  unlikeReview(logId: string): Promise<void>;

  // ----- Stage 5: lists -----

  createList(input: NewListInput): Promise<MediaList>;
  /** A user's lists, newest first. Other people only see the public ones. */
  getListsForUser(userId: string): Promise<ListWithItems[]>;
  /** One list, or null if it doesn't exist or is someone else's private list. */
  getList(listId: string): Promise<ListWithItems | null>;
  deleteList(listId: string): Promise<void>;
  /** Adds an item at the END of one of your lists (caching the item first if needed). */
  addToList(listId: string, media: MediaResult): Promise<ListWithItems>;
  removeFromList(listId: string, mediaItemId: string): Promise<ListWithItems>;
  /**
   * Saves a new order: `orderedMediaItemIds` lists EVERY item of the list, first
   * to last. Throws if an item is missing or extra (e.g. changed in another tab).
   */
  reorderList(listId: string, orderedMediaItemIds: string[]): Promise<ListWithItems>;
}
