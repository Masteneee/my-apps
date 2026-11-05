"use client";
// The shared streaks part of /friends: your active shared streaks (count,
// best, what's left to do today), invites to answer, invites you sent, and
// the form to start a new one.

import Link from "next/link";
import { useState } from "react";
import { getCheckinStore } from "@/lib/checkin";
import { getFriendsStore, type FriendshipView, type SharedStreakView } from "@/lib/friends";
import { friendName, sharedStreakHint } from "@/lib/friends/shared-streaks";
import { buttonPrimary, card, input, label, link } from "../ui";
import { smallButton, useAction } from "./useAction";
import type { FriendsData } from "./useFriendsData";

// The value of the "make a new habit for this" choice in the habit picker.
const NEW_HABIT = "__new__";

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

type Props = { data: FriendsData; friends: FriendshipView[]; reload: () => void };

export function SharedStreaksSection({ data, friends, reload }: Props) {
  const { busy, error, run } = useAction(reload);
  const store = getFriendsStore();
  const invites = data.streaks.filter((s) => s.status === "pending" && s.direction === "incoming");
  const waiting = data.streaks.filter((s) => s.status === "pending" && s.direction === "outgoing");

  function stop(view: SharedStreakView) {
    if (!window.confirm(`Stop your shared streak on ${view.habit_name} with ${friendName(view.friend)}? It ends for both of you.`)) return;
    run(() => store.removeSharedStreak(view.id));
  }

  return (
    <section className={card} aria-labelledby="shared-streaks">
      <h2 id="shared-streaks" className="font-semibold">
        Shared streaks
      </h2>

      {data.summaries.length === 0 && invites.length === 0 && waiting.length === 0 && (
        <p className="mt-1 text-sm text-muted">None yet. Pick a friend and one of your habits below.</p>
      )}

      <ul className="mt-2 divide-y divide-line">
        {data.summaries.map(({ view, result }) => (
          <li key={view.id} className="py-3">
            <p className="font-medium">
              {view.habit_name} <span className="font-normal text-muted">with {friendName(view.friend)}</span>
            </p>
            <p className="mt-1 flex items-baseline gap-3">
              <span className="text-3xl font-semibold tabular-nums">
                <span aria-hidden="true">🔥 </span>
                {result.streak.current}
                <span className="ml-1 text-base font-normal text-muted">
                  {result.streak.current === 1 ? "day" : "days"} together
                </span>
              </span>
              <span className="text-sm text-muted">best {result.streak.best}</span>
            </p>
            {/* Two small ticks: who did it today. Words, not just colours. */}
            <p className="mt-1 text-sm">
              You: {result.meDoneToday ? "✓ done" : "not yet"} · {friendName(view.friend)}:{" "}
              {result.friendDoneToday ? "✓ done" : "not yet"}
            </p>
            <p className="mt-1 text-sm text-muted">{sharedStreakHint(result, friendName(view.friend))}</p>
            <button type="button" disabled={busy} onClick={() => stop(view)} className={`mt-2 ${smallButton}`}>
              Stop sharing
            </button>
          </li>
        ))}

        {invites.map((view) => (
          <Invite key={view.id} view={view} data={data} busy={busy} run={run} />
        ))}

        {waiting.map((view) => (
          <li key={view.id} className="flex items-center gap-2 py-3">
            <span className="min-w-0 flex-1 text-sm text-muted">
              {view.habit_name}: waiting for {friendName(view.friend)} to accept
            </span>
            <button type="button" disabled={busy} onClick={() => run(() => store.removeSharedStreak(view.id))} className={smallButton}>
              Cancel
            </button>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <StartSharedStreak data={data} friends={friends} busy={busy} run={run} />
    </section>
  );
}

type ActionProps = { busy: boolean; run: (action: () => Promise<unknown>) => Promise<boolean> };

/** An invite from a friend: pick which of YOUR habits counts, then accept. */
function Invite({ view, data, busy, run }: { view: SharedStreakView; data: FriendsData } & ActionProps) {
  // Start on your habit with the same name, if you have one; else "make a new one".
  const match = data.habits.find((h) => sameName(h.name, view.habit_name));
  const [choice, setChoice] = useState(match?.id ?? NEW_HABIT);

  async function accept() {
    await run(async () => {
      let habitId = choice;
      if (choice === NEW_HABIT) {
        // A simple yes/no habit with the same name. You can't see your
        // friend's habit (its type or goal), only its name.
        habitId = (await getCheckinStore().createHabit({ name: view.habit_name, type: "checkbox" })).id;
      }
      await getFriendsStore().acceptSharedStreak(view.id, habitId);
    });
  }

  return (
    <li className="py-3">
      <p className="text-sm">
        <strong>{friendName(view.friend)}</strong> wants to keep a streak on <strong>{view.habit_name}</strong> with you.
      </p>
      <label className={`mt-2 ${label}`}>
        Which of your habits counts?
        <select className={input} value={choice} onChange={(e) => setChoice(e.target.value)}>
          {data.habits.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
          {!match && <option value={NEW_HABIT}>New yes/no habit: {view.habit_name}</option>}
        </select>
      </label>
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={busy} onClick={accept} className={smallButton}>
          Accept
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => getFriendsStore().removeSharedStreak(view.id))}
          className={smallButton}
        >
          Decline
        </button>
      </div>
    </li>
  );
}

function StartSharedStreak({ data, friends, busy, run }: { data: FriendsData; friends: FriendshipView[] } & ActionProps) {
  const [friendId, setFriendId] = useState("");
  const [habitId, setHabitId] = useState("");

  if (friends.length === 0) {
    return <p className="mt-3 text-sm text-muted">Add a friend first, then you can share a habit with them.</p>;
  }
  if (data.habits.length === 0) {
    return (
      <p className="mt-3 text-sm text-muted">
        You need a habit to share.{" "}
        <Link href="/habits" className={link}>
          Add one
        </Link>
        .
      </p>
    );
  }

  // Empty choice = the first one in the list (so the form works without touching the selects).
  const chosenFriend = friendId || friends[0].friend.id;
  const chosenHabit = data.habits.find((h) => h.id === habitId) ?? data.habits[0];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(() => getFriendsStore().createSharedStreak(chosenFriend, chosenHabit));
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-line pt-4">
      <h3 className="text-sm font-semibold">Start a shared streak</h3>
      <label className={label}>
        Friend
        <select className={input} value={chosenFriend} onChange={(e) => setFriendId(e.target.value)}>
          {friends.map((f) => (
            <option key={f.friend.id} value={f.friend.id}>
              {friendName(f.friend)} (@{f.friend.username})
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Your habit
        <select className={input} value={chosenHabit.id} onChange={(e) => setHabitId(e.target.value)}>
          {data.habits.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-muted">
        Your friend will see the habit&apos;s name and which days you did it (past days too). Nothing else.
      </p>
      <button type="submit" disabled={busy} className={buttonPrimary}>
        Invite
      </button>
    </form>
  );
}
