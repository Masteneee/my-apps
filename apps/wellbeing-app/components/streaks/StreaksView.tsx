"use client";
// The /streaks page: your check-in streak, a calendar heatmap (mood, or one
// habit at a time), and every habit's current and best streak.
// All the counting happens in lib/streaks.ts and lib/calendar.ts (tested);
// this file loads the data and draws it.

import Link from "next/link";
import { useState } from "react";
import { buildCalendarGrid, HABIT_DONE_LEVEL, habitLevels, moodLevels, shortDate } from "@/lib/calendar";
import { addDays } from "@/lib/checkin/date";
import { moodFor } from "@/lib/checkin/steps";
import { FREEZE_EVERY_DAYS, streakHint, type Streak } from "@/lib/streaks";
import { buttonSecondary, card, link } from "../ui";
import { useRequireAccount } from "../useRequireAccount";
import { CalendarHeatmap, HeatmapLegend } from "./CalendarHeatmap";
import { useStreakData, type StreakData } from "./useStreakData";

export function StreaksView() {
  const { ready } = useRequireAccount();
  const { loaded, retry } = useStreakData(ready);

  if (!ready || !loaded) return <p className="text-muted">Loading...</p>;

  if (loaded.error !== null) {
    return (
      <div className={card}>
        <p>{loaded.error}</p>
        <button type="button" onClick={retry} className={`mt-4 ${buttonSecondary}`}>
          Try again
        </button>
      </div>
    );
  }

  return <Streaks data={loaded.data} />;
}

function Streaks({ data }: { data: StreakData }) {
  const { summary, today } = data;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Streaks</h1>
        <p className="mt-1 text-sm text-muted">Days in a row. Today counts until midnight.</p>
      </header>

      <section className={card} aria-labelledby="checkin-streak">
        <h2 id="checkin-streak" className="font-semibold">
          Check-in streak
        </h2>
        <StreakNumbers streak={summary.checkin} />
        <p className="mt-2 text-sm text-muted">{streakHint(summary.checkin)}</p>
        <FreezeNote streak={summary.checkin} today={today} />
      </section>

      <CalendarSection data={data} />

      <section className={card} aria-labelledby="habit-streaks">
        <h2 id="habit-streaks" className="font-semibold">
          Habit streaks
        </h2>
        {summary.habits.length === 0 ? (
          <p className="mt-1 text-sm text-muted">
            No habits yet.{" "}
            <Link href="/habits" className={link}>
              Add one
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {summary.habits.map(({ habit, streak }) => (
              <li key={habit.id} className="py-3">
                <p className="font-medium">
                  {habit.icon && <span aria-hidden="true">{habit.icon} </span>}
                  {habit.name}
                </p>
                <StreakNumbers streak={streak} />
                <p className="mt-1 text-sm text-muted">{streakHint(streak)}</p>
                <p className="mt-1 text-xs text-muted">{missedLately(streak, today)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className={`${card} text-sm`}>
        <summary className="cursor-pointer font-semibold">How streaks and freezes work</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
          <li>A streak is the number of days in a row you did it.</li>
          <li>Today doesn&apos;t count against you until it&apos;s over: you have until midnight (your phone&apos;s time).</li>
          <li>
            Miss <strong>one</strong> day between two done days, and a <strong>freeze</strong> (❄) saves your streak. The
            frozen day doesn&apos;t add to the count.
          </li>
          <li>You get one freeze every {FREEZE_EVERY_DAYS} days. Two missed days in a row end the streak.</li>
          <li>Habits with a daily goal count as done when you reach the goal.</li>
        </ul>
      </details>

      <Link href="/breathe" className={buttonSecondary}>
        Take a breathing break
      </Link>
    </div>
  );
}

/** "🔥 5 days · best 12" */
function StreakNumbers({ streak }: { streak: Streak }) {
  return (
    <p className="mt-1 flex items-baseline gap-3">
      <span className="text-3xl font-semibold tabular-nums">
        <span aria-hidden="true">🔥 </span>
        {streak.current}
        <span className="ml-1 text-base font-normal text-muted">{streak.current === 1 ? "day" : "days"}</span>
      </span>
      <span className="text-sm text-muted">best {streak.best}</span>
    </p>
  );
}

function FreezeNote({ streak, today }: { streak: Streak; today: string }) {
  if (streak.best === 0) return null;
  const ready = streak.freezeReadyOn === today;
  return (
    <p className="mt-1 text-xs text-muted">
      <span aria-hidden="true">❄ </span>
      {ready ? "A freeze is ready if you miss a day." : `Next freeze ready on ${shortDate(streak.freezeReadyOn)}.`}
    </p>
  );
}

/** "Missed 2 days in the last 30." (frozen days don't count as missed) */
function missedLately(streak: Streak, today: string): string {
  const since = addDays(today, -30);
  const missed = streak.missedDays.filter((day) => day >= since).length;
  const frozen = streak.frozenDays.filter((day) => day >= since).length;
  const parts = [`Missed ${missed} ${missed === 1 ? "day" : "days"} in the last 30`];
  if (frozen > 0) parts.push(`${frozen} saved by a freeze`);
  return parts.join(", ") + ".";
}

// ---------------------------------------------------------------------------

function CalendarSection({ data }: { data: StreakData }) {
  // "mood", or the id of the habit whose calendar is shown.
  const [selected, setSelected] = useState<string>("mood");
  const chosen = data.summary.habits.find((h) => h.habit.id === selected) ?? null;
  const kind = chosen ? "habit" : "mood";

  const grid = chosen
    ? buildCalendarGrid({
        today: data.today,
        levels: habitLevels(chosen.habit, data.entries),
        frozen: chosen.streak.frozenDays,
      })
    : buildCalendarGrid({ today: data.today, levels: moodLevels(data.checkinDays) });

  function describeLevel(level: number): string {
    if (!chosen) return moodFor(level)?.label ?? String(level);
    if (level === HABIT_DONE_LEVEL) return "Done";
    return ["", "A bit", "Partway", "Almost"][level] ?? "";
  }

  const options = [
    { id: "mood", label: "Mood" },
    ...data.summary.habits.map(({ habit }) => ({ id: habit.id, label: `${habit.icon ? habit.icon + " " : ""}${habit.name}` })),
  ];

  return (
    <section className={card} aria-labelledby="calendar-title">
      <h2 id="calendar-title" className="font-semibold">
        Calendar
      </h2>
      <p className="mt-1 text-sm text-muted">The last 12 weeks. Pick what to show:</p>

      {/* A row of buttons that scrolls sideways if there are many habits. */}
      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Show the calendar for">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected === option.id}
            onClick={() => setSelected(option.id)}
            className="min-h-11 shrink-0 rounded-full border border-line px-4 text-sm aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <CalendarHeatmap
          grid={grid}
          kind={kind}
          caption={`${chosen ? chosen.habit.name : "Mood"} calendar, last 12 weeks`}
          describeLevel={describeLevel}
        />
        <HeatmapLegend kind={kind} describeLevel={describeLevel} />
      </div>
    </section>
  );
}
