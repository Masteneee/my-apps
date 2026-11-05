"use client";
// The /friends page: add a friend by username, answer requests, see your
// friends, and your shared streaks (in SharedStreaksSection).
// Every button calls the friends store, then reloads the page's data.

import Link from "next/link";
import { useState } from "react";
import { getDemoFriendTools, getFriendsStore, type FriendshipView } from "@/lib/friends";
import { DEMO_FRIEND } from "@/lib/friends/demo-friend";
import { friendName, nudges, nudgeText } from "@/lib/friends/shared-streaks";
import { buttonPrimary, buttonSecondary, card, input, label } from "../ui";
import { useRequireAccount } from "../useRequireAccount";
import { SharedStreaksSection } from "./SharedStreaksSection";
import { smallButton, useAction } from "./useAction";
import { useFriendsData, type FriendsData } from "./useFriendsData";

export function FriendsView() {
  const { ready, user } = useRequireAccount();
  const { loaded, reload } = useFriendsData(ready && user ? user.id : null);

  if (!ready || !loaded) return <p className="text-muted">Loading...</p>;

  if (loaded.error !== null) {
    return (
      <div className={card}>
        <p>{loaded.error}</p>
        <button type="button" onClick={reload} className={`mt-4 ${buttonSecondary}`}>
          Try again
        </button>
      </div>
    );
  }

  return <Friends data={loaded.data} reload={reload} />;
}

function Friends({ data, reload }: { data: FriendsData; reload: () => void }) {
  const accepted = data.friendships.filter((f) => f.status === "accepted");
  const incoming = data.friendships.filter((f) => f.status === "pending" && f.direction === "incoming");
  const outgoing = data.friendships.filter((f) => f.status === "pending" && f.direction === "outgoing");
  const myTurn = nudges(data.summaries);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Friends</h1>
        <p className="mt-1 text-sm text-muted">Keep a streak going together. It only grows on days you both do it.</p>
      </header>

      {/* The gentle nudge. In-app only: no notifications. */}
      {myTurn.length > 0 && (
        <section className={`${card} border-accent`} aria-labelledby="your-turn">
          <h2 id="your-turn" className="font-semibold">
            Your turn
          </h2>
          <ul className="mt-1 space-y-1 text-sm">
            {myTurn.map(({ view }) => (
              <li key={view.id}>{nudgeText(friendName(view.friend), view.habit_name)}</li>
            ))}
          </ul>
          <Link href="/checkin" className={`mt-3 ${buttonPrimary}`}>
            Open my check-in
          </Link>
        </section>
      )}

      <SharedStreaksSection data={data} friends={accepted} reload={reload} />

      <AddFriend reload={reload} />

      {incoming.length > 0 && <IncomingRequests requests={incoming} reload={reload} />}

      <FriendList friends={accepted} outgoing={outgoing} reload={reload} />

      <DemoFriendCard hasSam={accepted.some((f) => f.friend.id === DEMO_FRIEND.id)} reload={reload} />

      <p className="text-xs text-muted">
        What friends see: your username, your display name and, only for habits you share with them, which days you did
        them. Never your mood, screen time, gratitude or journal.
      </p>
    </div>
  );
}

function AddFriend({ reload }: { reload: () => void }) {
  const [username, setUsername] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const { busy, error, run } = useAction(reload);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(null);
    const ok = await run(async () => {
      const r = await getFriendsStore().sendFriendRequest(username);
      // "accepted" right away: they had already asked you (or it's demo Sam).
      setSent(r.status === "accepted" ? `You and ${r.friend.username} are now friends.` : `Request sent to ${r.friend.username}.`);
    });
    if (ok) setUsername("");
  }

  return (
    <section className={card} aria-labelledby="add-friend">
      <h2 id="add-friend" className="font-semibold">
        Add a friend
      </h2>
      <form onSubmit={handleSubmit} className="mt-2 space-y-3">
        <label className={label}>
          Their username
          <input
            className={input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="e.g. sam_demo"
          />
        </label>
        <button type="submit" disabled={busy} className={buttonPrimary}>
          Send request
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {sent && (
        <p aria-live="polite" className="mt-2 text-sm text-muted">
          {sent}
        </p>
      )}
    </section>
  );
}

function IncomingRequests({ requests, reload }: { requests: FriendshipView[]; reload: () => void }) {
  const { busy, error, run } = useAction(reload);
  const friends = getFriendsStore();
  return (
    <section className={card} aria-labelledby="requests">
      <h2 id="requests" className="font-semibold">
        Friend requests
      </h2>
      <ul className="mt-2 divide-y divide-line">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="min-w-0 flex-1 truncate">
              <strong>{friendName(r.friend)}</strong> <span className="text-sm text-muted">@{r.friend.username}</span>
            </span>
            <button type="button" disabled={busy} onClick={() => run(() => friends.respondToFriendRequest(r.id, true))} className={smallButton}>
              Accept
            </button>
            <button type="button" disabled={busy} onClick={() => run(() => friends.respondToFriendRequest(r.id, false))} className={smallButton}>
              Decline
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}

function FriendList({ friends, outgoing, reload }: { friends: FriendshipView[]; outgoing: FriendshipView[]; reload: () => void }) {
  const { busy, error, run } = useAction(reload);
  const store = getFriendsStore();

  function remove(f: FriendshipView) {
    // A real "are you sure?": unfriending also ends your shared streaks.
    if (!window.confirm(`Remove ${friendName(f.friend)}? Your shared streaks with them end too.`)) return;
    run(() => store.removeFriendship(f.id));
  }

  return (
    <section className={card} aria-labelledby="friend-list">
      <h2 id="friend-list" className="font-semibold">
        Your friends
      </h2>
      {friends.length === 0 && outgoing.length === 0 && (
        <p className="mt-1 text-sm text-muted">No friends yet. Ask a friend for their username (it&apos;s on their profile page).</p>
      )}
      <ul className="mt-2 divide-y divide-line">
        {friends.map((f) => (
          <li key={f.id} className="flex items-center gap-2 py-2">
            <span className="min-w-0 flex-1 truncate">
              <strong>{friendName(f.friend)}</strong> <span className="text-sm text-muted">@{f.friend.username}</span>
            </span>
            <button type="button" disabled={busy} onClick={() => remove(f)} className={smallButton}>
              Remove
            </button>
          </li>
        ))}
        {outgoing.map((f) => (
          <li key={f.id} className="flex items-center gap-2 py-2">
            <span className="min-w-0 flex-1 truncate text-muted">@{f.friend.username}: waiting for them to accept</span>
            <button type="button" disabled={busy} onClick={() => run(() => store.removeFriendship(f.id))} className={smallButton}>
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
    </section>
  );
}

/** Demo mode only: a pretend friend, so you can try all this in one browser. */
function DemoFriendCard({ hasSam, reload }: { hasSam: boolean; reload: () => void }) {
  const tools = getDemoFriendTools();
  const { busy, error, run } = useAction(reload);
  if (!tools) return null; // Supabase mode: real friends only

  return (
    <section className={`${card} border-dashed`} aria-labelledby="demo-friend">
      <h2 id="demo-friend" className="font-semibold">
        Demo mode: a pretend friend
      </h2>
      <p className="mt-1 text-sm text-muted">
        Demo mode lives in this browser only, so there&apos;s nobody real to add. <strong>Sam</strong> is a demo account
        that says yes to everything and has done shared habits on most of the last 2 weeks.
      </p>
      <div className="mt-3 space-y-2">
        {!hasSam && (
          <button type="button" disabled={busy} onClick={() => run(() => tools.addDemoFriend())} className={buttonSecondary}>
            Add Sam, a demo friend
          </button>
        )}
        {hasSam && (
          <button type="button" disabled={busy} onClick={() => run(() => tools.demoFriendChecksInToday())} className={buttonSecondary}>
            Sam checks in today
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        To see Sam&apos;s side, log out and log in as <code>{DEMO_FRIEND.email}</code> / <code>{DEMO_FRIEND.password}</code>.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
