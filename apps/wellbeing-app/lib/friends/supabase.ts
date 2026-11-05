// The REAL friends store, used when the Supabase keys are set. Same
// `FriendsStore` contract as the demo store (./mock.ts).
//
// The database decides who may see and change what (RLS in the Stage 4
// migration). The checks here are only for quick, friendly messages.
// Friends' habit days come ONLY from the shared_streak_days function, which
// returns (who, which day) and nothing else.

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "../checkin/supabase";
import { OfflineError } from "../checkin/types";
import { validateDateRange } from "../checkin/validation";
import type { Friendship, FriendsStore, PublicProfile, SharedDay, SharedStreak } from "./types";
import { checkFriendRequest, cleanFriendUsername, findPair, otherPerson, toFriendshipView, toSharedStreakView } from "./views";

// Only the PUBLIC columns of profiles: never bio or anything added later.
const PUBLIC_PROFILE_COLUMNS = "id, username, display_name";
const FRIENDSHIP_COLUMNS = "id, user_a, user_b, status, created_at";
const SHARED_STREAK_COLUMNS = "id, friendship_id, habit_name, user_a, user_b, habit_a, habit_b, status, created_at";

type SupabaseErrorLike = { code?: string; message: string };
type Result = { error: SupabaseErrorLike | null; status?: number };

/** Database errors, in words. `what` says which table we were working on. */
export function friendlyFriendsError(error: SupabaseErrorLike, what: "friendship" | "shared streak"): string {
  switch (error.code) {
    case "23505": // unique_violation: one friendship per pair / one shared streak per habit and friend
      return what === "friendship"
        ? "You're already friends, or one of you already asked."
        : "You already share this habit with them.";
    case "23503": // foreign_key_violation: the person or habit is gone, or the habit isn't yours
      return what === "friendship" ? "That person doesn't exist any more." : "Pick one of your own active habits.";
    case "42501": // RLS said no
      return what === "friendship"
        ? "You can't change that friendship. Reload the page."
        : "You can only share a streak with a friend. Reload the page.";
    case "PGRST116": // .single() found no row: it was already removed, or isn't ours
      return `That ${what} doesn't exist any more. Reload the page.`;
    default:
      return error.message || "Something went wrong. Please try again.";
  }
}

/** Same idea as toStoreError in lib/checkin/supabase.ts: status 0 = no internet. */
export function toFriendsError(result: Result, what: "friendship" | "shared streak"): Error | null {
  if (!result.error) return null;
  if (result.status === 0) return new OfflineError("You're offline. Friends and shared streaks need the internet.");
  return new Error(friendlyFriendsError(result.error, what));
}

export function createSupabaseFriendsStore(supabase: SupabaseClient): FriendsStore {
  async function requireUser(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) throw new Error("You need to be logged in to see your friends.");
    return userId;
  }

  function throwIfError(result: Result, what: "friendship" | "shared streak") {
    const error = toFriendsError(result, what);
    if (error) throw error;
  }

  /** Public profiles of these people, by id. One request for all of them. */
  async function profilesById(ids: string[]): Promise<Map<string, PublicProfile>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const result = await supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).in("id", unique);
    throwIfError(result, "friendship");
    return new Map(((result.data ?? []) as PublicProfile[]).map((p) => [p.id, p]));
  }

  // RLS already limits these to rows I'm in, so no filter is needed. A person
  // has few friends, far below Supabase's 1000-row page, so no paging here.
  async function myFriendshipRows(): Promise<Friendship[]> {
    const result = await supabase.from("friendships").select(FRIENDSHIP_COLUMNS).order("created_at", { ascending: true });
    throwIfError(result, "friendship");
    return (result.data ?? []) as Friendship[];
  }

  const store: FriendsStore = {
    mode: "supabase",

    async findProfileByUsername(username) {
      await requireUser();
      const result = await supabase
        .from("profiles")
        .select(PUBLIC_PROFILE_COLUMNS)
        .eq("username", username.trim().toLowerCase())
        .maybeSingle();
      throwIfError(result, "friendship");
      return (result.data as PublicProfile | null) ?? null;
    },

    async listFriendships() {
      const me = await requireUser();
      const rows = await myFriendshipRows();
      const people = await profilesById(rows.map((r) => otherPerson(r, me)));
      return rows.map((r) => toFriendshipView(r, me, people));
    },

    async sendFriendRequest(username) {
      const me = await requireUser();
      const cleaned = cleanFriendUsername(username);
      if (!cleaned.ok) throw new Error(cleaned.error);
      const friend = await store.findProfileByUsername(cleaned.value);
      const existing = friend ? findPair(await myFriendshipRows(), me, friend.id) : undefined;
      const check = checkFriendRequest(me, friend, existing);
      if (check.action === "error") throw new Error(check.error);

      const result =
        check.action === "accept"
          ? await supabase
              .from("friendships")
              .update({ status: "accepted" })
              .eq("id", check.friendshipId)
              .select(FRIENDSHIP_COLUMNS)
              .single()
          : await supabase
              .from("friendships")
              .insert({ user_a: me, user_b: friend!.id })
              .select(FRIENDSHIP_COLUMNS)
              .single();
      throwIfError(result, "friendship");
      return toFriendshipView(result.data as Friendship, me, new Map([[friend!.id, friend!]]));
    },

    async respondToFriendRequest(friendshipId, accept) {
      const me = await requireUser();
      // .select() makes Supabase send back the changed rows, so we can tell
      // "nothing matched" (already answered) from "done".
      const result = accept
        ? await supabase
            .from("friendships")
            .update({ status: "accepted" })
            .eq("id", friendshipId)
            .eq("user_b", me)
            .select("id")
            .single()
        : await supabase.from("friendships").delete().eq("id", friendshipId).eq("user_b", me).select("id").single();
      throwIfError(result, "friendship");
    },

    async removeFriendship(friendshipId) {
      await requireUser();
      // The database deletes its shared streaks too (on delete cascade).
      const result = await supabase.from("friendships").delete().eq("id", friendshipId).select("id").single();
      throwIfError(result, "friendship");
    },

    async listSharedStreaks() {
      const me = await requireUser();
      const result = await supabase
        .from("shared_streaks")
        .select(SHARED_STREAK_COLUMNS)
        .order("created_at", { ascending: true });
      throwIfError(result, "shared streak");
      const rows = (result.data ?? []) as SharedStreak[];
      const people = await profilesById(rows.map((r) => otherPerson(r, me)));
      return rows.map((r) => toSharedStreakView(r, me, people));
    },

    async createSharedStreak(friendId, habit) {
      const me = await requireUser();
      const friendship = findPair(await myFriendshipRows(), me, friendId);
      if (!friendship || friendship.status !== "accepted") throw new Error("You can only share a streak with a friend.");
      const result = await supabase
        .from("shared_streaks")
        .insert({ friendship_id: friendship.id, habit_name: habit.name, user_a: me, user_b: friendId, habit_a: habit.id })
        .select(SHARED_STREAK_COLUMNS)
        .single();
      throwIfError(result, "shared streak");
      return toSharedStreakView(result.data as SharedStreak, me, await profilesById([friendId]));
    },

    async acceptSharedStreak(streakId, myHabitId) {
      const me = await requireUser();
      const result = await supabase
        .from("shared_streaks")
        .update({ habit_b: myHabitId, status: "active" })
        .eq("id", streakId)
        .eq("user_b", me)
        .select("id")
        .single();
      throwIfError(result, "shared streak");
    },

    async removeSharedStreak(streakId) {
      await requireUser();
      const result = await supabase.from("shared_streaks").delete().eq("id", streakId).select("id").single();
      throwIfError(result, "shared streak");
    },

    async listSharedStreakDays(streakId, from, to) {
      await requireUser();
      const range = validateDateRange(from, to);
      if (!range.ok) throw new Error(range.error);
      // .rpc() calls a database function. Its answer is limited to 1000 rows
      // like any other, so we page through it (the function sorts its rows).
      const rows = await fetchAllPages<{ user_id: string; day: string }>((first, last) =>
        supabase.rpc("shared_streak_days", { p_streak_id: streakId, p_from: from, p_to: to }).range(first, last),
      );
      return rows.map((r): SharedDay => ({ user_id: r.user_id, date: r.day }));
    },
  };
  return store;
}
