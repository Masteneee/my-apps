// Pure functions for the social side (Stage 5): building the home feed,
// counting review likes, and the rules for who may like what.
// No React and no database here, so both stores (demo and Supabase) share
// them and feed.test.ts can check every rule.

import { wordsFor } from "./display";
import type { LogWithMedia, PublicProfile, ReviewLike, SocialLog } from "./types";

/** The feed shows at most this many logs (the newest ones). */
export const FEED_LIMIT = 50;

/** Newest first. Two logs at the exact same time: the bigger id first, so the order never "jumps". */
export function newestFirst<T extends { id: string; created_at: string }>(logs: T[]): T[] {
  // [...logs] copies the array: .sort() changes the array it's called on, and
  // we don't want to surprise whoever passed it to us.
  return [...logs].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
}

/**
 * The home feed: logs written by the people you follow, newest first, at most `limit`.
 * The demo store passes EVERY log it has; the Supabase store passes what the
 * database already filtered, and this still guarantees the order and the limit.
 */
export function buildFeed<T extends LogWithMedia>(logs: T[], followingIds: string[], limit = FEED_LIMIT): T[] {
  // A Set answers "is this id in it?" instantly, even with thousands of ids.
  const following = new Set(followingIds);
  return newestFirst(logs.filter((log) => following.has(log.user_id))).slice(0, limit);
}

/** Likes per log: how many, and whether `me` is one of them. */
export function summarizeLikes(
  likes: ReviewLike[],
  me: string | null,
): Map<string, { count: number; likedByMe: boolean }> {
  const byLog = new Map<string, { count: number; likedByMe: boolean }>();
  for (const like of likes) {
    const current = byLog.get(like.log_id) ?? { count: 0, likedByMe: false };
    byLog.set(like.log_id, {
      count: current.count + 1,
      likedByMe: current.likedByMe || like.user_id === me,
    });
  }
  return byLog;
}

/**
 * Glues together logs, their authors and their likes into what the feed shows.
 * A log whose author isn't in `authors` is skipped (only possible if a profile
 * was deleted in the middle, or with hand-edited demo data). Keeps the logs' order.
 */
export function attachSocial(
  logs: LogWithMedia[],
  authors: PublicProfile[],
  likes: ReviewLike[],
  me: string | null,
): SocialLog[] {
  const authorById = new Map(authors.map((author) => [author.id, author]));
  const likesByLog = summarizeLikes(likes, me);
  const result: SocialLog[] = [];
  for (const log of logs) {
    const author = authorById.get(log.user_id);
    if (!author) continue;
    const summary = likesByLog.get(log.id);
    result.push({ ...log, author, likeCount: summary?.count ?? 0, likedByMe: summary?.likedByMe ?? false });
  }
  return result;
}

/** Only logs with a written review can be liked (a bare star rating can't). */
export function hasReview(log: { review_text: string | null }): boolean {
  return log.review_text !== null && log.review_text.trim() !== "";
}

/**
 * Why `me` may NOT like this log, or null if they may. The same two rules are
 * in the database (the insert policy on review_likes); this gives friendly words.
 */
export function likeProblem(log: { user_id: string; review_text: string | null }, me: string | null): string | null {
  if (!me) return "You need to be logged in to like a review.";
  if (!hasReview(log)) return "Only reviews can be liked, and this log has no review.";
  if (log.user_id === me) return "You can't like your own review.";
  return null;
}

/**
 * What a feed line says after the name: "@aiko watched Interstellar",
 * "is reading Berserk", "wants to play Hades", "rewatched Spirited Away".
 */
export function feedAction(log: LogWithMedia): string {
  const words = wordsFor(log.media.type);
  // "Watched" -> "watched", "Reading" -> "reading"...
  const status = words.statuses[log.status].toLowerCase();
  switch (log.status) {
    case "completed":
      // A rewatch/reread/replay: "re" + "watched" reads naturally for all three verbs.
      return log.rewatch ? `re${status}` : status;
    case "in_progress":
      return `is ${status}`; // "is watching", "is reading", "is playing"
    case "planned":
      return status.replace(/^want to/, "wants to"); // "wants to watch"
    case "dropped":
      return "dropped";
    case "paused":
      return "paused";
  }
}

/** The name to show for a person: their display name, or @username. */
export function displayName(profile: Pick<PublicProfile, "username" | "display_name">): string {
  return profile.display_name || `@${profile.username}`;
}

/**
 * After a like/unlike, the page swaps in the new count for ONE log and keeps
 * the rest. Returns a new array (React notices the change), never edits the old one.
 */
export function applyLikeChange<T extends SocialLog>(
  logs: T[],
  logId: string,
  change: { likeCount: number; likedByMe: boolean },
): T[] {
  return logs.map((log) => (log.id === logId ? { ...log, ...change } : log));
}
