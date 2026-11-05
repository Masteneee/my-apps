"use client";
// Loads everything the streak screens need (home card and /streaks): your
// active habits, the days you checked in and all your habit entries, then
// works out the streaks with the pure functions in lib/streaks.ts.

import { useEffect, useState } from "react";
import { getCheckinStore, type CheckinDay, type Habit, type HabitEntry } from "@/lib/checkin";
import { todayKey } from "@/lib/checkin/date";
import { HISTORY_START, summarizeStreaks, type StreakSummary } from "@/lib/streaks";

export type StreakData = {
  today: string;
  habits: Habit[];
  checkinDays: CheckinDay[];
  entries: HabitEntry[];
  summary: StreakSummary;
};

type Loaded = { data: StreakData; error: null } | { data: null; error: string };

async function loadStreakData(): Promise<StreakData> {
  // "Today" in this phone's time zone, worked out here in the browser.
  const today = todayKey();
  const store = getCheckinStore();
  // One after the other: the first call also sends anything waiting from offline.
  const checkinDays = await store.listCheckinDays(HISTORY_START, today);
  const entries = await store.listHabitEntries(HISTORY_START, today);
  const habits = await store.listHabits(); // active habits only (archived ones keep their history)
  return { today, habits, checkinDays, entries, summary: summarizeStreaks(habits, checkinDays, entries, today) };
}

/** `enabled`: only load once we know who is signed in. */
export function useStreakData(enabled: boolean) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0); // bumping it re-runs the effect ("Try again")

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false; // the page was left before the answer came back: ignore it
    loadStreakData()
      .then((data) => !cancelled && setLoaded({ data, error: null }))
      .catch((err) => {
        if (cancelled) return;
        setLoaded({ data: null, error: err instanceof Error ? err.message : "Couldn't load your streaks." });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, attempt]);

  return { loaded, retry: () => setAttempt((n) => n + 1) };
}
