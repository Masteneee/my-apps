"use client";
// The "Streaks" card on the home page: your check-in streak and your best
// three habit streaks, with a link to the full page (/streaks).
// Stage 5: also this week's average mood, with a link to the weekly insights
// (/insights). Same data, so no second load.

import Link from "next/link";
import { formatMood, weeklyMoods } from "@/lib/insights";
import { streakHint } from "@/lib/streaks";
import { card, link } from "../ui";
import { useStreakData } from "./useStreakData";

export function StreaksCard() {
  // The home page only shows this card once you're signed in, so load right away.
  const { loaded } = useStreakData(true);

  return (
    <section className={card}>
      <h2 className="font-semibold">Streaks</h2>

      {!loaded && <p className="mt-1 text-sm text-muted">Loading...</p>}
      {loaded?.error && <p className="mt-1 text-sm text-muted">{loaded.error}</p>}

      {loaded?.data && (
        <>
          <p className="mt-1 text-sm">
            <span aria-hidden="true">🔥 </span>
            <strong className="tabular-nums">{loaded.data.summary.checkin.current}</strong> check-in{" "}
            {loaded.data.summary.checkin.current === 1 ? "day" : "days"} in a row.{" "}
            <span className="text-muted">{streakHint(loaded.data.summary.checkin)}</span>
          </p>

          {/* Your 3 longest current habit streaks. [...list] copies it: sort() would change the original. */}
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {[...loaded.data.summary.habits]
              .filter((h) => h.streak.current > 0)
              .sort((a, b) => b.streak.current - a.streak.current)
              .slice(0, 3)
              .map(({ habit, streak }) => (
                <li key={habit.id}>
                  {habit.icon && <span aria-hidden="true">{habit.icon} </span>}
                  {habit.name}: {streak.current} {streak.current === 1 ? "day" : "days"}
                </li>
              ))}
          </ul>
          <ThisWeekMood checkinDays={loaded.data.checkinDays} today={loaded.data.today} />
        </>
      )}

      <div className="mt-3 flex flex-wrap gap-x-5">
        <Link href="/insights" className={`${link} inline-flex min-h-11 items-center text-sm`}>
          Weekly insights
        </Link>
        <Link href="/streaks" className={`${link} inline-flex min-h-11 items-center text-sm`}>
          Streaks and calendar
        </Link>
        <Link href="/breathe" className={`${link} inline-flex min-h-11 items-center text-sm`}>
          Breathing exercise
        </Link>
      </div>
    </section>
  );
}

/** "This week: average mood 3.8 (4 days)." Nothing until there's a mood this week. */
function ThisWeekMood({ checkinDays, today }: { checkinDays: { date: string; mood: number | null }[]; today: string }) {
  // weeklyMoods(..., 1) = just the current week (Monday to today).
  const [week] = weeklyMoods(checkinDays, today, 1);
  if (week.average === null) return null;
  return (
    <p className="mt-2 text-sm">
      This week: average mood <strong className="tabular-nums">{formatMood(week.average)}</strong>{" "}
      <span className="text-muted">
        ({week.moodDays} {week.moodDays === 1 ? "day" : "days"})
      </span>
    </p>
  );
}
