"use client";
// The "Friends" card on the home page: the gentle nudge ("Sam checked in,
// your turn"), friend requests waiting for you, and your shared streaks.
// In-app only: no push notifications. It's shown when you open the app.

import Link from "next/link";
import { friendName, nudges, nudgeText } from "@/lib/friends/shared-streaks";
import { useAuth } from "../AuthProvider";
import { card, link } from "../ui";
import { useFriendsData } from "./useFriendsData";

export function FriendsCard() {
  const { user } = useAuth();
  const { loaded } = useFriendsData(user?.id ?? null);
  const data = loaded?.data;

  const myTurn = data ? nudges(data.summaries) : [];
  const requests = data
    ? data.friendships.filter((f) => f.status === "pending" && f.direction === "incoming").length +
      data.streaks.filter((s) => s.status === "pending" && s.direction === "incoming").length
    : 0;

  return (
    <section className={card}>
      <h2 className="font-semibold">Friends</h2>

      {!loaded && <p className="mt-1 text-sm text-muted">Loading...</p>}
      {/* Offline in Supabase mode, or the Stage 4 SQL isn't run yet: stay quiet, just offer the link. */}
      {loaded?.error && <p className="mt-1 text-sm text-muted">Shared streaks load when you&apos;re online.</p>}

      {myTurn.length > 0 && (
        // aria-live: a screen reader announces the nudge when it appears.
        <ul aria-live="polite" className="mt-2 space-y-1 rounded-xl bg-accent-soft p-3 text-sm">
          {myTurn.map(({ view }) => (
            <li key={view.id}>
              <span aria-hidden="true">👋 </span>
              {nudgeText(friendName(view.friend), view.habit_name)}
            </li>
          ))}
        </ul>
      )}

      {requests > 0 && (
        <p className="mt-2 text-sm">
          {requests} {requests === 1 ? "request is" : "requests are"} waiting for you.
        </p>
      )}

      {data && data.summaries.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {data.summaries.map(({ view, result }) => (
            <li key={view.id}>
              {view.habit_name} with {friendName(view.friend)}: {result.streak.current}{" "}
              {result.streak.current === 1 ? "day" : "days"}
            </li>
          ))}
        </ul>
      )}

      {data && data.summaries.length === 0 && myTurn.length === 0 && requests === 0 && (
        <p className="mt-1 text-sm text-muted">Keep a streak going with a friend: it only grows on days you both do it.</p>
      )}

      <Link href="/friends" className={`${link} mt-1 inline-flex min-h-11 items-center text-sm`}>
        Friends and shared streaks
      </Link>
    </section>
  );
}
