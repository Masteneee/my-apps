// The REAL media store, used when the Supabase keys are set. It reads and
// writes the `media_items` and `logs` tables. Row Level Security (see the
// Stage 2 migration) makes sure you can only write logs as yourself.

import type { SupabaseClient } from "@supabase/supabase-js";
import { attachSocial, buildFeed, FEED_LIMIT, likeProblem } from "./feed";
import { validateListInput } from "./lists";
import { nextPosition, positionChanges, sortByPosition } from "./reorder";
import {
  MEDIA_POOL_LIMIT,
  type ListItemWithMedia,
  type ListWithItems,
  type Log,
  type LogWithMedia,
  type MediaItem,
  type MediaList,
  type MediaResult,
  type MediaStore,
  type PublicProfile,
  type ReviewLike,
  type SocialLog,
} from "./types";
import { localToday, mediaItemFields, planLogUpdate, validateLogInput } from "./validation";

// `genres` since Stage 6: without that migration, every request that reads items fails (see friendlyMediaError).
const MEDIA_COLUMNS = "id, type, source, source_id, title, year, cover_url, creators, total_units, genres, cached_at";
const LOG_COLUMNS =
  "id, user_id, media_item_id, status, rating, progress, progress_unit, review_text, started_at, finished_at, rewatch, created_at";
// "media:media_items(...)" asks Supabase to also fetch the media item each log
// points to (through the media_item_id foreign key) and put it under `media`.
// One request instead of one per log.
const LOG_WITH_MEDIA_COLUMNS = `${LOG_COLUMNS}, media:media_items(${MEDIA_COLUMNS})`;

// Stage 5. "author:profiles(...)" works because logs.user_id and lists.user_id
// point to profiles.id (a foreign key): Supabase follows it and puts the
// profile under `author`, in the same request.
const AUTHOR_COLUMNS = "id, username, display_name, avatar_url";
const SOCIAL_LOG_COLUMNS = `${LOG_WITH_MEDIA_COLUMNS}, author:profiles(${AUTHOR_COLUMNS})`;
const LIST_COLUMNS = "id, user_id, title, description, is_public, created_at";
// A list, its owner, and its items each with their media item: 3 tables deep, one request.
const LIST_WITH_ITEMS_COLUMNS = `${LIST_COLUMNS}, author:profiles(${AUTHOR_COLUMNS}), items:list_items(list_id, media_item_id, position, note, media:media_items(${MEDIA_COLUMNS}))`;

type SocialLogRow = Log & { media: MediaItem; author: PublicProfile };
type ListRow = MediaList & { author: PublicProfile; items: ListItemWithMedia[] };

// The database returns a list's items in no particular order, so we sort them here.
function toListWithItems(row: ListRow): ListWithItems {
  return { ...row, items: sortByPosition(row.items ?? []) };
}

/** Turns database errors into sentences a user understands. */
export function friendlyMediaError(error: { code?: string; message: string }): string {
  switch (error.code) {
    case "42501": // RLS said no
      return "You can only change your own logs, lists, likes and follows. Try logging in again.";
    case "23503": // foreign key: the log points to a profile that doesn't exist
      return "Pick a username before logging anything.";
    case "23514": // check constraint: the database refused a value
      return "The database refused one of the values (rating, review length or date).";
    case "42P01": // Postgres: table doesn't exist
    case "PGRST205": // Supabase API: table not found
      // review_likes is the one table added by the Stage 5 migration.
      if (error.message?.includes("review_likes")) {
        return "The likes table doesn't exist yet. Run the Stage 5 migration in Supabase (see README.md).";
      }
      return "The media tables don't exist yet. Run the Stage 2 migration in Supabase (see README.md).";
    case "22P02": // Postgres: "invalid input syntax", e.g. a list id that isn't a real id
      return "That link doesn't look right.";
    case "42703": // Postgres: column doesn't exist (reading progress_unit or genres)
    case "PGRST204": // Supabase API: column not found (writing progress_unit or genres)
      if (error.message?.includes("genres")) {
        return "The database is missing the Stage 6 genres column. Run the Stage 6 migration in Supabase (see README.md).";
      }
      return "The database is missing the Stage 4 progress columns. Run the Stage 4 migration in Supabase (see README.md).";
    default:
      return error.message || "Something went wrong. Please try again.";
  }
}

// Supabase returns Postgres `numeric` values as numbers, but we convert with
// Number() anyway in case one arrives as text ("3.5"). Since Stage 4,
// `progress` is numeric too (12.5 hours).
function toLogWithMedia(row: Log & { media: MediaItem }): LogWithMedia {
  return {
    ...row,
    rating: row.rating === null ? null : Number(row.rating),
    progress: row.progress === null ? null : Number(row.progress),
  };
}

export function createSupabaseMediaStore(supabase: SupabaseClient): MediaStore {
  /** The signed-in user's id, or null. (getSession reads the saved login, no network.) */
  async function currentUserId(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  }

  async function requireUser(action: string): Promise<string> {
    const userId = await currentUserId();
    if (!userId) throw new Error(`You need to be logged in to ${action}.`);
    return userId;
  }

  /** Find the cached item, or create it the first time anyone logs it (or adds it to a list). */
  async function findOrCreateMediaItem(result: MediaResult): Promise<MediaItem> {
    const fields = mediaItemFields(result);

    const findExisting = () =>
      supabase
        .from("media_items")
        .select(MEDIA_COLUMNS)
        .eq("source", fields.source)
        .eq("type", fields.type)
        .eq("source_id", fields.source_id)
        .maybeSingle();

    const existing = await findExisting();
    if (existing.error) throw new Error(friendlyMediaError(existing.error));
    if (existing.data) return existing.data as MediaItem;

    const inserted = await supabase.from("media_items").insert(fields).select(MEDIA_COLUMNS).single();
    if (!inserted.error) return inserted.data as MediaItem;

    // 23505 = "unique rule broken": someone else cached the same item between
    // our search and our insert. Not a real problem, just read their copy.
    if (inserted.error.code === "23505") {
      const again = await findExisting();
      if (again.data) return again.data as MediaItem;
    }
    throw new Error(friendlyMediaError(inserted.error));
  }

  async function getFollowing(userId: string): Promise<string[]> {
    const { data, error } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
    if (error) throw new Error(friendlyMediaError(error));
    return (data as { following_id: string }[]).map((row) => row.following_id);
  }

  /** Adds authors (already in the rows) and likes (one more request) to some logs. */
  async function withSocial(rows: SocialLogRow[]): Promise<SocialLog[]> {
    if (rows.length === 0) return [];
    const logs = rows.map((row) => toLogWithMedia(row));
    // "All likes of these logs" in ONE request, instead of one per log.
    const { data, error } = await supabase
      .from("review_likes")
      .select("user_id, log_id")
      .in(
        "log_id",
        logs.map((log) => log.id),
      );
    if (error) throw new Error(friendlyMediaError(error));
    const authors = rows.map((row) => row.author).filter((author): author is PublicProfile => author !== null);
    return attachSocial(logs, authors, data as ReviewLike[], await currentUserId());
  }

  async function getList(listId: string): Promise<ListWithItems | null> {
    // RLS hides other people's private lists: they come back as "no row".
    const { data, error } = await supabase.from("lists").select(LIST_WITH_ITEMS_COLUMNS).eq("id", listId).maybeSingle();
    if (error?.code === "22P02") return null; // not a real id (someone typed the URL): "not found"
    if (error) throw new Error(friendlyMediaError(error));
    return data ? toListWithItems(data as unknown as ListRow) : null;
  }

  /** One of YOUR lists, or a friendly error. (RLS would refuse the change anyway, silently.) */
  async function requireOwnList(listId: string, action: string): Promise<string> {
    const me = await requireUser(action);
    const { data, error } = await supabase.from("lists").select("user_id").eq("id", listId).maybeSingle();
    if (error) throw new Error(friendlyMediaError(error));
    if (!data) throw new Error("That list doesn't exist anymore. Reload the page.");
    if ((data as { user_id: string }).user_id !== me) throw new Error("You can only change your own lists.");
    return me;
  }

  async function reloadList(listId: string): Promise<ListWithItems> {
    const list = await getList(listId);
    if (!list) throw new Error("That list doesn't exist anymore. Reload the page.");
    return list;
  }

  return {
    mode: "supabase",

    async addLog(input) {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) throw new Error("You need to be logged in to log something.");

      // Friendly checks first; the database checks again with its own rules.
      const checked = validateLogInput(input, localToday());
      if (!checked.ok) throw new Error(checked.error);

      const media = await findOrCreateMediaItem(input.media);

      const { data, error } = await supabase
        .from("logs")
        .insert({ user_id: user.id, media_item_id: media.id, ...checked.value })
        .select(LOG_WITH_MEDIA_COLUMNS)
        .single();
      if (error) throw new Error(friendlyMediaError(error));
      return toLogWithMedia(data as unknown as Log & { media: MediaItem });
    },

    async getLogsForUser(userId) {
      const { data, error } = await supabase
        .from("logs")
        .select(LOG_WITH_MEDIA_COLUMNS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(friendlyMediaError(error));
      return (data as unknown as (Log & { media: MediaItem })[]).map(toLogWithMedia);
    },

    async getMediaItem({ type, source, sourceId }) {
      const { data, error } = await supabase
        .from("media_items")
        .select(MEDIA_COLUMNS)
        .eq("type", type)
        .eq("source", source)
        .eq("source_id", sourceId)
        .maybeSingle(); // null instead of an error when nobody logged it yet
      if (error) throw new Error(friendlyMediaError(error));
      return (data as MediaItem | null) ?? null;
    },

    async getLogsForItem(mediaItemId) {
      // Everyone's logs of this item (logs are public, see the RLS policies).
      // The index logs_media_item_id_idx from Stage 2 makes this lookup fast.
      const { data, error } = await supabase
        .from("logs")
        .select(LOG_WITH_MEDIA_COLUMNS)
        .eq("media_item_id", mediaItemId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(friendlyMediaError(error));
      return (data as unknown as (Log & { media: MediaItem })[]).map(toLogWithMedia);
    },

    async updateLog(logId, change) {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) throw new Error("You need to be logged in to change a log.");

      // Read the log first: planLogUpdate needs its item (total episodes...) and current status.
      const current = await supabase.from("logs").select(LOG_WITH_MEDIA_COLUMNS).eq("id", logId).maybeSingle();
      if (current.error) throw new Error(friendlyMediaError(current.error));
      if (!current.data) throw new Error("That log doesn't exist anymore. Reload the page.");
      const log = toLogWithMedia(current.data as unknown as Log & { media: MediaItem });
      // A friendly early check; RLS would refuse anyway (the update would match no row).
      if (log.user_id !== user.id) throw new Error("You can only change your own logs.");

      const planned = planLogUpdate(log, change, localToday());
      if (!planned.ok) throw new Error(planned.error);

      const { data, error } = await supabase
        .from("logs")
        .update(planned.value)
        .eq("id", logId)
        .select(LOG_WITH_MEDIA_COLUMNS)
        .single();
      if (error) throw new Error(friendlyMediaError(error));
      return toLogWithMedia(data as unknown as Log & { media: MediaItem });
    },

    // ----- Stage 5: follows -----

    async follow(userId) {
      const me = await requireUser("follow someone");
      if (userId === me) throw new Error("You can't follow yourself.");
      // follower_id is filled in by the database (default auth.uid()); RLS checks it's you.
      const { error } = await supabase.from("follows").insert({ follower_id: me, following_id: userId });
      // 23505 = "already exists": you already follow them, which is what we wanted.
      if (error && error.code !== "23505") throw new Error(friendlyMediaError(error));
    },

    async unfollow(userId) {
      const me = await requireUser("unfollow someone");
      const { error } = await supabase.from("follows").delete().eq("follower_id", me).eq("following_id", userId);
      if (error) throw new Error(friendlyMediaError(error));
    },

    getFollowing,

    async getFollowers(userId) {
      const { data, error } = await supabase.from("follows").select("follower_id").eq("following_id", userId);
      if (error) throw new Error(friendlyMediaError(error));
      return (data as { follower_id: string }[]).map((row) => row.follower_id);
    },

    // ----- Stage 5: feed and review likes -----

    async getFeed() {
      const me = await currentUserId();
      if (!me) return [];
      const following = await getFollowing(me);
      if (following.length === 0) return [];
      // The database does the heavy part: only these people, newest first, at most FEED_LIMIT.
      // The index logs_user_id_created_at_idx (Stage 2) makes this fast.
      const { data, error } = await supabase
        .from("logs")
        .select(SOCIAL_LOG_COLUMNS)
        .in("user_id", following)
        .order("created_at", { ascending: false })
        .limit(FEED_LIMIT);
      if (error) throw new Error(friendlyMediaError(error));
      // buildFeed again: same order rule (ties by id) as the demo store.
      return buildFeed(await withSocial(data as unknown as SocialLogRow[]), following);
    },

    async getReviewsForItem(mediaItemId) {
      const { data, error } = await supabase
        .from("logs")
        .select(SOCIAL_LOG_COLUMNS)
        .eq("media_item_id", mediaItemId)
        .not("review_text", "is", null) // only logs with a review
        .order("created_at", { ascending: false });
      if (error) throw new Error(friendlyMediaError(error));
      return withSocial(data as unknown as SocialLogRow[]);
    },

    async likeReview(logId) {
      const me = await requireUser("like a review");
      // A friendly check first. The insert policy on review_likes checks the same
      // rules, but it can only say "no" (error 42501), not why.
      const { data: log, error: readError } = await supabase
        .from("logs")
        .select("user_id, review_text")
        .eq("id", logId)
        .maybeSingle();
      if (readError) throw new Error(friendlyMediaError(readError));
      if (!log) throw new Error("That review doesn't exist anymore. Reload the page.");
      const problem = likeProblem(log as { user_id: string; review_text: string | null }, me);
      if (problem) throw new Error(problem);

      const { error } = await supabase.from("review_likes").insert({ user_id: me, log_id: logId });
      if (error && error.code !== "23505") throw new Error(friendlyMediaError(error)); // 23505 = already liked
    },

    async unlikeReview(logId) {
      const me = await requireUser("unlike a review");
      const { error } = await supabase.from("review_likes").delete().eq("user_id", me).eq("log_id", logId);
      if (error) throw new Error(friendlyMediaError(error));
    },

    // ----- Stage 5: lists -----

    async createList(input) {
      const me = await requireUser("make a list");
      const checked = validateListInput(input);
      if (!checked.ok) throw new Error(checked.error);
      const { data, error } = await supabase
        .from("lists")
        .insert({ user_id: me, ...checked.value })
        .select(LIST_COLUMNS)
        .single();
      if (error) throw new Error(friendlyMediaError(error));
      return data as MediaList;
    },

    async getListsForUser(userId) {
      const { data, error } = await supabase
        .from("lists")
        .select(LIST_WITH_ITEMS_COLUMNS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(friendlyMediaError(error));
      return (data as unknown as ListRow[]).map(toListWithItems);
    },

    getList,

    async deleteList(listId) {
      await requireOwnList(listId, "delete a list");
      // "on delete cascade" on list_items removes the list's items too.
      const { error } = await supabase.from("lists").delete().eq("id", listId);
      if (error) throw new Error(friendlyMediaError(error));
    },

    async addToList(listId, media) {
      await requireOwnList(listId, "change a list");
      const item = await findOrCreateMediaItem(media);
      // The current positions, to put the new item at the end.
      const { data: rows, error: readError } = await supabase
        .from("list_items")
        .select("media_item_id, position")
        .eq("list_id", listId);
      if (readError) throw new Error(friendlyMediaError(readError));
      const position = nextPosition(rows as { media_item_id: string; position: number }[]);

      const { error } = await supabase.from("list_items").insert({ list_id: listId, media_item_id: item.id, position });
      // 23505 = the primary key (list_id, media_item_id) says it's already there.
      if (error?.code === "23505") throw new Error("It's already in this list.");
      if (error) throw new Error(friendlyMediaError(error));
      return reloadList(listId);
    },

    async removeFromList(listId, mediaItemId) {
      await requireOwnList(listId, "change a list");
      const { error } = await supabase.from("list_items").delete().eq("list_id", listId).eq("media_item_id", mediaItemId);
      if (error) throw new Error(friendlyMediaError(error));
      return reloadList(listId);
    },

    async reorderList(listId, orderedMediaItemIds) {
      await requireOwnList(listId, "change a list");
      const { data: rows, error: readError } = await supabase
        .from("list_items")
        .select("media_item_id, position")
        .eq("list_id", listId);
      if (readError) throw new Error(friendlyMediaError(readError));
      // Only the rows whose position changes (throws if the list changed elsewhere).
      const changes = positionChanges(rows as { media_item_id: string; position: number }[], orderedMediaItemIds);
      // One small update per moved row, sent at the same time. (Not one atomic
      // step: see "Decisions" in LEARNING.md, Stage 5.)
      const results = await Promise.all(
        changes.map((change) =>
          supabase
            .from("list_items")
            .update({ position: change.position })
            .eq("list_id", listId)
            .eq("media_item_id", change.media_item_id),
        ),
      );
      const failed = results.find((result) => result.error);
      if (failed?.error) throw new Error(friendlyMediaError(failed.error));
      return reloadList(listId);
    },

    // ----- Stage 6: recommendations -----

    async listMediaItems() {
      // Media items are public facts (the Stage 2 select policy lets anyone read them).
      // Newest first, and a limit, so this stays one small request as the table grows.
      const { data, error } = await supabase
        .from("media_items")
        .select(MEDIA_COLUMNS)
        .order("cached_at", { ascending: false })
        .limit(MEDIA_POOL_LIMIT);
      if (error) throw new Error(friendlyMediaError(error));
      return data as MediaItem[];
    },
  };
}
