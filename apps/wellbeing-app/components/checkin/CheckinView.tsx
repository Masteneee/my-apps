"use client";
// The /checkin page: checks you're logged in, works out TODAY (in your time
// zone), loads what's already saved for today, then shows the flow.

import { useEffect, useState } from "react";
import { getCheckinStore, type Checkin, type Habit, type HabitEntry } from "@/lib/checkin";
import { todayKey } from "@/lib/checkin/date";
import { buttonSecondary, card } from "../ui";
import { useRequireAccount } from "../useRequireAccount";
import { CheckinFlow } from "./CheckinFlow";

type Day = { date: string; checkin: Checkin | null; entries: HabitEntry[]; habits: Habit[] };
type Loaded = { day: Day; error: null } | { day: null; error: string };

async function loadToday(): Promise<Day> {
  // Worked out in the browser, never on the server: only the phone knows its time zone.
  const date = todayKey();
  const store = getCheckinStore();
  // One after the other: the first call also sends anything waiting from offline.
  const checkin = await store.getCheckin(date);
  const entries = await store.getHabitEntries(date);
  const habits = await store.listHabits();
  return { date, checkin, entries, habits };
}

export function CheckinView() {
  const { ready } = useRequireAccount();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0); // bumping it re-runs the effect ("Try again")

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    loadToday()
      .then((day) => !cancelled && setLoaded({ day, error: null }))
      .catch((err) => {
        if (cancelled) return;
        setLoaded({ day: null, error: err instanceof Error ? err.message : "Couldn't load today's check-in." });
      });
    return () => {
      cancelled = true;
    };
  }, [ready, attempt]);

  if (!ready || !loaded) return <p className="text-muted">Loading...</p>;

  if (loaded.error !== null) {
    return (
      <div className={card}>
        <p>Couldn&apos;t load today&apos;s check-in: {loaded.error}</p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={`mt-4 ${buttonSecondary}`}>
          Try again
        </button>
      </div>
    );
  }

  const { day } = loaded;
  // key={day.date}: a different day = a fresh flow with fresh state.
  return <CheckinFlow key={day.date} date={day.date} checkin={day.checkin} entries={day.entries} habits={day.habits} />;
}
