// The address of an item page (Stage 4): /media/[type]/[id].
//
// The [id] part is "<source>-<source id>", e.g. /media/anime/anilist-16498 or
// /media/book/openlibrary-OL893415W. We use the SOURCE's id rather than our
// database id because:
// - the demo store and Supabase make different database ids for the same item,
//   but "anilist-16498" is the same everywhere (links can be shared);
// - it's the same rule as the "unique (source, type, source_id)" in the database.

import { MEDIA_SOURCES, MEDIA_TYPES, type MediaItemRef, type MediaSource, type MediaType } from "./types";

/** /media/anime/anilist-16498 */
export function mediaItemPath(item: { type: MediaType; source: MediaSource; source_id: string }): string {
  // encodeURIComponent, in case a source id ever has a "/" or a space in it.
  return `/media/${item.type}/${item.source}-${encodeURIComponent(item.source_id)}`;
}

/**
 * Reads the two parts of the URL back. Null when the address is wrong
 * (unknown type or source, missing id), so the page can show "not found".
 */
export function parseMediaItemParams(type: string, id: string): MediaItemRef | null {
  let decoded: string;
  try {
    // Next.js may hand us the id still URL-encoded ("OL%20123"). A broken "%" makes
    // decodeURIComponent throw, which just means the address is wrong.
    decoded = decodeURIComponent(id);
  } catch {
    return null;
  }
  if (!(MEDIA_TYPES as readonly string[]).includes(type)) return null;

  // Split at the FIRST "-": source names have no dash, but a source id might.
  const dash = decoded.indexOf("-");
  if (dash === -1) return null;
  const source = decoded.slice(0, dash);
  const sourceId = decoded.slice(dash + 1);
  if (!(MEDIA_SOURCES as readonly string[]).includes(source) || sourceId === "") return null;

  return { type: type as MediaType, source: source as MediaSource, sourceId };
}
