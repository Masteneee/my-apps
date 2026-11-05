"use client";
// Loads everything the friends screens need (home card and /friends): your
// friendships, your shared streaks, your active habits, and for each active
// shared streak the days each of you did it. Then works out the shared
// streaks with the pure functions in lib/friends/shared-streaks.ts.

import { useCallback, useEffect, useState } from "react";
import { getCheckinStore, type Habit } from "@/lib/checkin";
import { todayKey } from "@/lib/checkin/date";
import { getFriendsStore, type FriendshipView, type SharedDay, type SharedStreakView } from "@/lib/friends";
import { summarizeSharedStreaks, type SharedStreakSummary } from "@/lib/friends/shared-streaks";
import { HISTORY_START } from "@/lib/streaks";

export type FriendsData = {
  today: string;
  friendships: FriendshipView[];
  streaks: SharedStreakView[];
  /** My active habits (to start or accept a shared streak). */
  habits: Habit[];
  /** One per ACTIVE shared streak: the count, today's status, the nudge. */
  summaries: SharedStreakSummary[];
};

type Loaded = { data: FriendsData; error: null } | { data: null; error: string };

async function loadFriendsData(myId: string): Promise<FriendsData> {
  const today = todayKey(); // in this phone's time zone
  const friends = getFriendsStore();
  const friendships = await friends.listFriendships();
  const streaks = await friends.listSharedStreaks();
  const habits = await getCheckinStore().listHabits();

  // Promise.all runs these at the same time (one request per active shared
  // streak) and waits for all of them.
  const active = streaks.filter((s) => s.status === "active");
  const days = await Promise.all(active.map((s) => friends.listSharedStreakDays(s.id, HISTORY_START, today)));
  const daysById = new Map<string, SharedDay[]>(active.map((s, i) => [s.id, days[i]]));

  return { today, friendships, streaks, habits, summaries: summarizeSharedStreaks(streaks, daysById, myId, today) };
}

/** `myId`: the signed-in user's id, or null while we don't know yet (nothing loads). */
export function useFriendsData(myId: string | null) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0); // bumping it re-runs the effect

  useEffect(() => {
    if (!myId) return;
    let cancelled = false; // the page was left before the answer came back: ignore it
    loadFriendsData(myId)
      .then((data) => !cancelled && setLoaded({ data, error: null }))
      .catch((err) => {
        if (cancelled) return;
        setLoaded({ data: null, error: err instanceof Error ? err.message : "Couldn't load your friends." });
      });
    return () => {
      cancelled = true;
    };
  }, [myId, attempt]);

  // useCallback keeps the same function between redraws, so it's safe to pass around.
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { loaded, reload };
}
