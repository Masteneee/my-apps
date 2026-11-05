// The REAL media store, used when the Supabase keys are set. It reads and
// writes the `media_items` and `logs` tables. Row Level Security (see the
// Stage 2 migration) makes sure you can only write logs as yourself.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Log, LogWithMedia, MediaItem, MediaStore, NewLogInput } from "./types";
import { localToday, mediaItemFields, planLogUpdate, validateLogInput } from "./validation";

const MEDIA_COLUMNS = "id, type, source, source_id, title, year, cover_url, creators, total_units, cached_at";
const LOG_COLUMNS =
  "id, user_id, media_item_id, status, rating, progress, progress_unit, review_text, started_at, finished_at, rewatch, created_at";
// "media:media_items(...)" asks Supabase to also fetch the media item each log
// points to (through the media_item_id foreign key) and put it under `media`.
// One request instead of one per log.
const LOG_WITH_MEDIA_COLUMNS = `${LOG_COLUMNS}, media:media_items(${MEDIA_COLUMNS})`;

/** Turns database errors into sentences a user understands. */
export function friendlyMediaError(error: { code?: string; message: string }): string {
  switch (error.code) {
    case "42501": // RLS said no
      return "You can only change your own logs. Try logging in again.";
    case "23503": // foreign key: the log points to a profile that doesn't exist
      return "Pick a username before logging anything.";
    case "23514": // check constraint: the database refused a value
      return "The database refused one of the values (rating, review length or date).";
    case "42P01": // Postgres: table doesn't exist
    case "PGRST205": // Supabase API: table not found
      return "The media tables don't exist yet. Run the Stage 2 migration in Supabase (see README.md).";
    case "42703": // Postgres: column doesn't exist (reading progress_unit)
    case "PGRST204": // Supabase API: column not found (writing progress_unit)
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
  /** Find the cached item, or create it the first time anyone logs it. */
  async function findOrCreateMediaItem(input: NewLogInput): Promise<MediaItem> {
    const fields = mediaItemFields(input.media);

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

  return {
    mode: "supabase",

    async addLog(input) {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) throw new Error("You need to be logged in to log something.");

      // Friendly checks first; the database checks again with its own rules.
      const checked = validateLogInput(input, localToday());
      if (!checked.ok) throw new Error(checked.error);

      const media = await findOrCreateMediaItem(input);

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
  };
}
