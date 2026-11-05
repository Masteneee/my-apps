// SHARED STREAKS: a streak you keep with a friend. Pure functions (no
// database, no clock), tested in shared-streaks.test.ts.
//
// THE RULE: the shared streak only goes up on days you BOTH completed the
// habit. So we don't need new streak logic at all: we work out the days you
// both did it (the "intersection" of your days and theirs) and hand them to
// the same, already tested computeStreak() from lib/streaks.ts.
//
// FREEZES on a shared streak (decided in Stage 4):
// - A day where only one of you (or neither) did it counts as "missed" for the
//   pair. The normal freeze rules then apply to the pair's days: ONE missed
//   day between two both-done days is frozen, at most one freeze per 7 days,
//   two missed days in a row end the streak.
// - The pair has ONE freeze between you (it's worked out from the pair's
//   days), separate from your own personal streak's freeze.
// - Like personal freezes, nothing is stored: it's recomputed every time.
//
// WHY COUNTS ARE NOT STORED: PLAN.md listed current_count / best_count /
// last_both_date columns. We left them out: they would be a copy (a "cache")
// of something we can compute from the facts (who did what on which day), and
// a copy can go stale (an old day synced late from offline, a habit entry
// removed, a freeze that moves). Each person can't even write the other's
// numbers safely. Store the facts, compute the rest.
//
// TIME ZONES: each person's days are THEIR local days (date keys made on their
// own phone, see lib/checkin/date.ts). "Both did it on Nov 5" means each of
// you did it on your own Nov 5. Your "today" is used to decide what's past.

import { computeStreak, type Streak } from "../streaks";
import type { PublicProfile, SharedDay, SharedStreakView } from "./types";

/** The days BOTH lists contain, oldest first, each once. */
export function bothDoneDates(mine: Iterable<string>, theirs: Iterable<string>): string[] {
  const theirSet = new Set(theirs);
  return [...new Set([...mine].filter((day) => theirSet.has(day)))].sort();
}

/** Splits the rows from listSharedStreakDays into my days and my friend's days. */
export function splitSharedDays(rows: SharedDay[], myId: string): { mine: string[]; theirs: string[] } {
  const mine: string[] = [];
  const theirs: string[] = [];
  for (const row of rows) (row.user_id === myId ? mine : theirs).push(row.date);
  return { mine, theirs };
}

export type SharedStreakResult = {
  /** The pair's streak: computeStreak on the both-done days. */
  streak: Streak;
  meDoneToday: boolean;
  friendDoneToday: boolean;
  /** The gentle nudge: my friend did it today and I haven't yet. */
  nudge: boolean;
};

export function computeSharedStreak(mine: string[], theirs: string[], today: string): SharedStreakResult {
  const meDoneToday = mine.includes(today);
  const friendDoneToday = theirs.includes(today);
  return {
    streak: computeStreak(bothDoneDates(mine, theirs), today),
    meDoneToday,
    friendDoneToday,
    nudge: friendDoneToday && !meDoneToday,
  };
}

/** The name to show for a friend: display name if set, else the username. */
export function friendName(friend: Pick<PublicProfile, "username" | "display_name">): string {
  return friend.display_name?.trim() || friend.username;
}

/** The nudge itself, in PLAN.md's words: "Sam checked in, your turn." */
export function nudgeText(name: string, habitName: string): string {
  return `${name} checked in for ${habitName}. Your turn!`;
}

/** What's going on today with this shared streak, in a sentence. */
export function sharedStreakHint(result: SharedStreakResult, name: string): string {
  if (result.meDoneToday && result.friendDoneToday) return "You both did it today.";
  if (result.nudge) return `${name} did it today. Your turn when you're ready.`;
  if (result.meDoneToday) return `You did it today. Waiting for ${name}.`;
  // Neither of you yet: same words as a personal streak, but "together".
  if (result.streak.status === "at-risk") {
    return "Yesterday wasn't done by both of you: do it together today and a freeze saves the streak.";
  }
  if (result.streak.status === "none") {
    return result.streak.best > 0 ? "No shared streak right now. Do it on the same day to start again." : "Do it on the same day to start a streak.";
  }
  // "pending" (a "done-today" status can't reach here: it needs both of you).
  return "Neither of you has done it yet today.";
}

// ---------------------------------------------------------------------------
// Everything the friends screens need, in one go
// ---------------------------------------------------------------------------

export type SharedStreakSummary = { view: SharedStreakView; result: SharedStreakResult };

/**
 * One result per ACTIVE shared streak. `daysById`: the rows from
 * listSharedStreakDays for each streak id. Pending invites are skipped
 * (there's nothing to count yet).
 */
export function summarizeSharedStreaks(
  streaks: SharedStreakView[],
  daysById: Map<string, SharedDay[]>,
  myId: string,
  today: string,
): SharedStreakSummary[] {
  return streaks
    .filter((view) => view.status === "active")
    .map((view) => {
      const { mine, theirs } = splitSharedDays(daysById.get(view.id) ?? [], myId);
      return { view, result: computeSharedStreak(mine, theirs, today) };
    });
}

/** The shared streaks where it's my turn (my friend did it today, I haven't). */
export function nudges(summaries: SharedStreakSummary[]): SharedStreakSummary[] {
  return summaries.filter((s) => s.result.nudge);
}
