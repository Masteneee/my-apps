// Stage 4: the shapes of friend and shared-streak data, and the "contract"
// (interface) every friends store must follow. Same idea as
// lib/checkin/types.ts: pages only talk to `FriendsStore`, so the demo store
// (localStorage) and the Supabase store can be swapped without them knowing.
//
// PRIVACY: nothing in this file carries a check-in field. A friend only ever
// gets your username / display name, and, for a habit you agreed to share,
// the DAYS you completed it (SharedDay). Never the value, never the journal.

/** What anyone signed in may see about another person (the `profiles` table already allows this). */
export type PublicProfile = {
  id: string;
  username: string;
  display_name: string | null;
};

export type FriendshipStatus = "pending" | "accepted";

/** One row of the `friendships` table. user_a ASKED, user_b was asked. */
export type Friendship = {
  id: string;
  user_a: string;
  user_b: string;
  status: FriendshipStatus;
  created_at: string;
};

/**
 * A friendship as the signed-in user sees it.
 * direction: "outgoing" = I asked them, "incoming" = they asked me.
 * (Only matters while it's pending.)
 */
export type FriendshipView = {
  id: string;
  status: FriendshipStatus;
  direction: "incoming" | "outgoing";
  friend: PublicProfile;
  created_at: string;
};

export type SharedStreakStatus = "pending" | "active";

/**
 * One row of the `shared_streaks` table. user_a created it on their habit
 * habit_a; user_b accepts it by picking one of THEIR habits (habit_b).
 * There is no current_count / best_count column: counts are worked out from
 * both people's days every time (see lib/friends/shared-streaks.ts).
 */
export type SharedStreak = {
  id: string;
  friendship_id: string;
  habit_name: string;
  user_a: string;
  user_b: string;
  habit_a: string;
  habit_b: string | null;
  status: SharedStreakStatus;
  created_at: string;
};

/**
 * A shared streak as the signed-in user sees it.
 * direction: "outgoing" = I created it, "incoming" = my friend invited me.
 * myHabitId: MY habit in it (null while an invite to me is still pending).
 */
export type SharedStreakView = {
  id: string;
  habit_name: string;
  status: SharedStreakStatus;
  direction: "incoming" | "outgoing";
  friend: PublicProfile;
  myHabitId: string | null;
  created_at: string;
};

/** "This person completed the shared habit on this day." The ONLY habit data a friend gets. */
export type SharedDay = { user_id: string; date: string };

export type FriendsMode = "supabase" | "mock";

export interface FriendsStore {
  readonly mode: FriendsMode;

  /** Someone's public profile by username (any case), or null if nobody has it. */
  findProfileByUsername(username: string): Promise<PublicProfile | null>;

  /** All my friendships: accepted ones and pending requests (both directions), oldest first. */
  listFriendships(): Promise<FriendshipView[]>;
  /**
   * Asks `username` to be friends. If THEY had already asked me, this accepts
   * their request instead (so nobody waits for nothing). Throws a friendly Error.
   */
  sendFriendRequest(username: string): Promise<FriendshipView>;
  /** Accept (true) or decline (false) a request someone sent me. Declining deletes it. */
  respondToFriendRequest(friendshipId: string, accept: boolean): Promise<void>;
  /** Cancel my request, or stop being friends. Also ends the shared streaks between us. */
  removeFriendship(friendshipId: string): Promise<void>;

  /** All my shared streaks (active ones and invites, both directions), oldest first. */
  listSharedStreaks(): Promise<SharedStreakView[]>;
  /** Invite an accepted friend to a shared streak on one of MY active habits. */
  createSharedStreak(friendId: string, habit: { id: string; name: string }): Promise<SharedStreakView>;
  /** Accept an invite by picking which of MY active habits counts for it. */
  acceptSharedStreak(streakId: string, myHabitId: string): Promise<void>;
  /** Decline an invite, cancel mine, or stop a shared streak (for both people). */
  removeSharedStreak(streakId: string): Promise<void>;
  /**
   * The days each of the two people completed their habit in this shared
   * streak, between `from` and `to` (both included). Only for ACTIVE shared
   * streaks I'm part of. In Supabase this is the security-definer function
   * `shared_streak_days` (see the Stage 4 migration).
   */
  listSharedStreakDays(streakId: string, from: string, to: string): Promise<SharedDay[]>;
}
