// Turning database rows into what the signed-in user sees ("views"), and the
// small checks both stores share. Pure functions, tested in views.test.ts.
// Both the demo store and the Supabase store use these, so they can't disagree.

import { validateUsername } from "../auth/validation";
import type { Friendship, FriendshipView, PublicProfile, SharedStreak, SharedStreakView } from "./types";

/** The other person in a pair: if I'm user_a it's user_b, and the other way round. */
export function otherPerson(row: { user_a: string; user_b: string }, me: string): string {
  return row.user_a === me ? row.user_b : row.user_a;
}

/** Someone whose profile we couldn't load (e.g. deleted account). Never crash on it. */
function unknownProfile(id: string): PublicProfile {
  return { id, username: "unknown", display_name: null };
}

export function toFriendshipView(row: Friendship, me: string, profiles: Map<string, PublicProfile>): FriendshipView {
  const friendId = otherPerson(row, me);
  return {
    id: row.id,
    status: row.status,
    // user_a is the one who asked.
    direction: row.user_a === me ? "outgoing" : "incoming",
    friend: profiles.get(friendId) ?? unknownProfile(friendId),
    created_at: row.created_at,
  };
}

export function toSharedStreakView(
  row: SharedStreak,
  me: string,
  profiles: Map<string, PublicProfile>,
): SharedStreakView {
  const friendId = otherPerson(row, me);
  return {
    id: row.id,
    habit_name: row.habit_name,
    status: row.status,
    direction: row.user_a === me ? "outgoing" : "incoming",
    friend: profiles.get(friendId) ?? unknownProfile(friendId),
    // Only MY habit id. (The friend's habit id is in the row, but the app has no use for it.)
    myHabitId: row.user_a === me ? row.habit_a : row.habit_b,
    created_at: row.created_at,
  };
}

/** Oldest first, like the rest of the app. */
export function byCreatedAt<T extends { created_at: string }>(a: T, b: T): number {
  return a.created_at.localeCompare(b.created_at);
}

/** The friendship between me and `friendId`, if any (either direction). */
export function findPair<T extends { user_a: string; user_b: string }>(rows: T[], me: string, friendId: string): T | undefined {
  return rows.find(
    (r) => (r.user_a === me && r.user_b === friendId) || (r.user_a === friendId && r.user_b === me),
  );
}

export type FriendRequestCheck =
  | { action: "error"; error: string }
  | { action: "insert" } // ask them
  | { action: "accept"; friendshipId: string }; // they already asked me: accept it

/**
 * What to do when I ask `friend` to be friends, given what already exists
 * between us. Shared by both stores so they give the same answers.
 */
export function checkFriendRequest(me: string, friend: PublicProfile | null, existing: Friendship | undefined): FriendRequestCheck {
  if (!friend) return { action: "error", error: "Nobody has that username. Check the spelling." };
  if (friend.id === me) return { action: "error", error: "That's you! Ask a friend for their username." };
  if (!existing) return { action: "insert" };
  if (existing.status === "accepted") return { action: "error", error: `You're already friends with ${friend.username}.` };
  if (existing.user_a === me) return { action: "error", error: `You already asked ${friend.username}. Waiting for them to accept.` };
  return { action: "accept", friendshipId: existing.id };
}

/** Cleans a username typed in the "Add a friend" box, or explains what's wrong. */
export function cleanFriendUsername(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  // Strip a leading "@", people often type usernames that way.
  const typed = raw.trim().replace(/^@/, "");
  if (typed === "") return { ok: false, error: "Type your friend's username." };
  const check = validateUsername(typed);
  // A reserved name can't belong to anyone: same answer as "nobody has it".
  if (!check.ok) return { ok: false, error: "Nobody has that username. Check the spelling." };
  return check;
}
