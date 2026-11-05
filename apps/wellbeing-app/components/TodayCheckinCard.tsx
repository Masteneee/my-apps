"use client";
// The "Today's check-in" card on the home page: Start / Continue / Done,
// with a short summary of what's answered so far.

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCheckinStore } from "@/lib/checkin";
import { todayKey } from "@/lib/checkin/date";
import { fieldsOf } from "@/lib/checkin/merge";
import { answeredCount, moodFor, STEPS } from "@/lib/checkin/steps";
import { buttonPrimary, buttonSecondary, card } from "./ui";

type Summary = { started: boolean; answered: number; moodValue: number | null; waiting: number };

async function loadSummary(): Promise<Summary> {
  const store = getCheckinStore();
  const date = todayKey();
  const checkin = await store.getCheckin(date); // also sends anything waiting from offline
  const entries = await store.getHabitEntries(date);
  const fields = fieldsOf(checkin);
  return {
    started: checkin !== null || entries.length > 0,
    answered: answeredCount(fields, entries.length),
    moodValue: fields.mood,
    waiting: await store.pendingSyncCount(),
  };
}

export function TodayCheckinCard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSummary()
      .then((result) => !cancelled && setSummary(result))
      // Can't load (e.g. the database tables don't exist yet): still offer the button.
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const mood = moodFor(summary?.moodValue ?? null);
  const done = summary !== null && summary.answered === STEPS.length;

  return (
    <section className={card}>
      <h2 className="font-semibold">Today&apos;s check-in</h2>

      {!summary && !failed && <p className="mt-1 text-sm text-muted">Loading...</p>}
      {(failed || (summary && !summary.started)) && (
        <p className="mt-1 text-sm text-muted">
          About 5 minutes: mood, screen time, three good things, a few lines and your habits. Skip anything.
        </p>
      )}
      {summary?.started && (
        <p className="mt-1 text-sm text-muted">
          {mood && <span aria-hidden="true">{mood.emoji} </span>}
          {summary.answered} of {STEPS.length} parts answered{done ? ". All done for today." : "."}
        </p>
      )}
      {summary !== null && summary.waiting > 0 && (
        <p className="mt-1 text-xs text-muted">
          {summary.waiting} {summary.waiting === 1 ? "change is" : "changes are"} saved on this device and will sync
          when you&apos;re online.
        </p>
      )}

      <Link href="/checkin" className={`mt-4 ${done ? buttonSecondary : buttonPrimary}`}>
        {!summary?.started ? "Start check-in" : done ? "Change my answers" : "Continue check-in"}
      </Link>
      <Link href="/habits" className="mt-2 inline-flex min-h-11 items-center text-sm text-muted underline-offset-4 hover:underline">
        Manage habits
      </Link>
    </section>
  );
}
