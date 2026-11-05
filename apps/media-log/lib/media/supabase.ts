// The REAL media store, used when the Supabase keys are set. It reads and
// writes the `media_items` and `logs` tables. Row Level Security (see the
// Stage 2 migration) makes sure you can only write logs as yourself.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Log, LogWithMedia, MediaItem, MediaStore, NewLogInput } from "./types";
import { localToday, mediaItemFields, validateLogInput } from "./validation";

const MEDIA_COLUMNS = "id, type, source, source_id, title, year, cover_url, creators, total_units, cached_at";
const LOG_COLUMNS =
  "id, user_id, media_item_id, status, rating, progress, review_text, started_at, finished_at, rewatch, created_at";
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
    default:
      return error.message || "Something went wrong. Please try again.";
  }
}

// Supabase returns Postgres `numeric` values as numbers, but we convert with
// Number() anyway in case one arrives as text ("3.5").
function toLogWithMedia(row: Log & { media: MediaItem }): LogWithMedia {
  return { ...row, rating: row.rating === null ? null : Number(row.rating) };
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
  };
}
