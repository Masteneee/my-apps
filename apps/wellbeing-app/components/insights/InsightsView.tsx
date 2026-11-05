"use client";
// The /insights page: the weekly summary. Your mood this week and week by
// week, and which habits go with better mood days.
// All the maths is in lib/insights.ts (pure functions, tested); this file
// loads the data and draws it. It reuses the streaks' loader (same data:
// habits, the days with their mood, and habit entries; never the journal).

import Link from "next/link";
import { shortDate } from "@/lib/calendar";
import { browserTimeZone } from "@/lib/checkin/date";
import { RANGE_OFFLINE_MESSAGE } from "@/lib/checkin/offline";
import { moodFor } from "@/lib/checkin/steps";
import {
  buildWeeklySummary,
  dayCount,
  formatMood,
  habitSentence,
  INSIGHT_WEEKS,
  MIN_DAYS_EACH_SIDE,
  MIN_TREND_DAYS,
  SAME_BAND,
  trendSentence,
  type HabitMoodInsight,
  type WeeklySummary,
} from "@/lib/insights";
import { useStreakData, type StreakData } from "../streaks/useStreakData";
import { buttonSecondary, card, link } from "../ui";
import { useRequireAccount } from "../useRequireAccount";

export function InsightsView() {
  const { ready } = useRequireAccount();
  const { loaded, retry } = useStreakData(ready);

  if (!ready || !loaded) return <p className="text-muted">Loading...</p>;

  if (loaded.error !== null) {
    return (
      <div className={card}>
        {/* Offline in Supabase mode: same reason as streaks (your history is on the server). */}
        <p>{loaded.error === RANGE_OFFLINE_MESSAGE ? "You're offline. Insights will load when you're back online." : loaded.error}</p>
        <button type="button" onClick={retry} className={`mt-4 ${buttonSecondary}`}>
          Try again
        </button>
      </div>
    );
  }

  return <Insights data={loaded.data} />;
}

function Insights({ data }: { data: StreakData }) {
  const summary = buildWeeklySummary({ ...data, timeZone: browserTimeZone() });
  const { trend, thisWeek } = summary;
  const emoji = trend.thisWeek.average === null ? null : moodFor(Math.round(trend.thisWeek.average))?.emoji;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">This week</h1>
        <p className="mt-1 text-sm text-muted">
          From your own check-ins, with simple averages you could work out by hand. No AI.
        </p>
      </header>

      <section className={card} aria-labelledby="mood-week">
        <h2 id="mood-week" className="font-semibold">
          Your mood this week
        </h2>
        <p className="mt-1 flex items-baseline gap-3">
          {/* shrink-0 + nowrap: the emoji and the number stay together on one line. */}
          <span className="shrink-0 whitespace-nowrap text-3xl font-semibold tabular-nums">
            {emoji && <span aria-hidden="true">{emoji} </span>}
            {formatMood(trend.thisWeek.average)}
          </span>
          <span className="text-sm text-muted">
            average out of 5, {dayCount(trend.thisWeek.moodDays)} with a mood
          </span>
        </p>
        <p className="mt-2 text-sm">{trendSentence(trend)}</p>
        <p className="mt-2 text-xs text-muted">
          Checked in on {dayCount(thisWeek.checkinDays)} since Monday
          {thisWeek.habitDays.some((h) => h.days > 0) && (
            <>
              {" · "}
              {thisWeek.habitDays
                .filter((h) => h.days > 0)
                .map((h) => `${h.habit.name} ${h.days}×`)
                .join(", ")}
            </>
          )}
          .
        </p>
      </section>

      <WeekByWeek summary={summary} />

      <HabitsAndMood summary={summary} />

      <section className="rounded-2xl bg-accent-soft p-5 text-sm" aria-labelledby="not-cause">
        <h2 id="not-cause" className="font-semibold">
          Correlation, not cause
        </h2>
        <p className="mt-2">
          &quot;Higher on days you did it&quot; means the two happen together, not that one causes the other. Maybe the habit
          lifts your mood. Maybe you only do it on days you already feel good. Maybe something else (sleep, weekends,
          the weather) drives both. A few weeks of days can&apos;t tell these apart, so treat it as a hint to try things,
          not a fact about you.
        </p>
      </section>

      <details className={`${card} text-sm`}>
        <summary className="cursor-pointer font-semibold">How these numbers are worked out</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
          <li>Weeks run Monday to Sunday, using the dates on your phone (its time zone).</li>
          <li>Only days where you picked a mood count. A day without one is left out, not counted as a bad day.</li>
          <li>
            Week vs last week: each needs a mood on at least {MIN_TREND_DAYS} days. A change smaller than {SAME_BAND} (out
            of 5) is called &quot;about the same&quot;.
          </li>
          <li>
            Habits: the last {INSIGHT_WEEKS} weeks, without today (it isn&apos;t over). Average mood on days you did the
            habit vs days you didn&apos;t, from the day you added the habit. A habit with a daily goal counts as done when
            you reach the goal.
          </li>
          <li>
            Nothing is shown until there are {MIN_DAYS_EACH_SIDE} days on each side. Differences under {SAME_BAND} are
            called &quot;about the same&quot;.
          </li>
        </ul>
      </details>

      <Link href="/streaks" className={buttonSecondary}>
        Streaks and calendar
      </Link>
    </div>
  );
}

/** One row per week: a bar as long as the average mood (out of 5), and the numbers in words. */
function WeekByWeek({ summary }: { summary: WeeklySummary }) {
  return (
    <section className={card} aria-labelledby="by-week">
      <h2 id="by-week" className="font-semibold">
        Mood, week by week
      </h2>
      <p className="mt-1 text-sm text-muted">Average mood of each week (1 to 5). The number of days is beside it.</p>
      <ul className="mt-3 space-y-2">
        {[...summary.weeks].reverse().map((week) => (
          <li key={week.weekStart} className="grid grid-cols-[4.5rem_1fr_6.5rem] items-center gap-2 text-sm">
            <span className="text-muted">{week.isCurrent ? "This week" : shortDate(week.weekStart)}</span>
            {/* The bar is decoration (aria-hidden): the numbers next to it say the same thing in words. */}
            <span aria-hidden="true" className="h-3 rounded-full bg-accent-soft">
              {week.average !== null && (
                <span className="block h-3 rounded-full bg-accent" style={{ width: `${(week.average / 5) * 100}%` }} />
              )}
            </span>
            <span className="text-right tabular-nums">
              {week.average === null ? (
                <span className="text-muted">no mood</span>
              ) : (
                <>
                  {formatMood(week.average)} <span className="text-muted">· {dayCount(week.moodDays)}</span>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HabitsAndMood({ summary }: { summary: WeeklySummary }) {
  const { habits } = summary;
  const range = summary.window; // the days the comparison used
  const withData = habits.filter((h) => h.verdict !== "not-enough");
  const needMore = habits.filter((h) => h.verdict === "not-enough");

  return (
    <section className={card} aria-labelledby="habits-mood">
      <h2 id="habits-mood" className="font-semibold">
        Habits and mood
      </h2>
      <p className="mt-1 text-sm text-muted">
        {shortDate(range.from)} to {shortDate(range.to)}, the last {INSIGHT_WEEKS} weeks. Today counts once it&apos;s over.
      </p>

      {habits.length === 0 && (
        <p className="mt-3 text-sm text-muted">
          No habits yet.{" "}
          <Link href="/habits" className={link}>
            Add one
          </Link>{" "}
          and check in for a couple of weeks to see this.
        </p>
      )}

      {withData.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {withData.map((insight) => (
            <HabitRow key={insight.habit.id} insight={insight} />
          ))}
        </ul>
      )}

      {needMore.length > 0 && (
        <div className="mt-3">
          {withData.length > 0 && <h3 className="text-sm font-medium">Needs more days</h3>}
          <ul className="mt-1 space-y-2 text-sm text-muted">
            {needMore.map((insight) => (
              <li key={insight.habit.id}>
                <span className="font-medium text-ink">
                  {insight.habit.icon && <span aria-hidden="true">{insight.habit.icon} </span>}
                  {insight.habit.name}:
                </span>{" "}
                {habitSentence(insight)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function HabitRow({ insight }: { insight: HabitMoodInsight }) {
  return (
    <li className="py-3">
      <p className="font-medium">
        {insight.habit.icon && <span aria-hidden="true">{insight.habit.icon} </span>}
        {insight.habit.name}
      </p>
      <p className="mt-1 text-sm">{habitSentence(insight)}</p>
      {/* The two numbers behind the sentence, with how many days each one is based on. */}
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-accent-soft p-3">
          <dt className="text-xs text-muted">Days you did it</dt>
          <dd>
            <span className="text-lg font-semibold tabular-nums">{formatMood(insight.doneAverage)}</span>{" "}
            <span className="text-muted">· {dayCount(insight.doneDays)}</span>
          </dd>
        </div>
        <div className="rounded-xl border border-line p-3">
          <dt className="text-xs text-muted">Days you didn&apos;t</dt>
          <dd>
            <span className="text-lg font-semibold tabular-nums">{formatMood(insight.notDoneAverage)}</span>{" "}
            <span className="text-muted">· {dayCount(insight.notDoneDays)}</span>
          </dd>
        </div>
      </dl>
    </li>
  );
}
