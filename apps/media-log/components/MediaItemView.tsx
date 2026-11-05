"use client";
// The item page /media/[type]/[id]: cover, info, everyone's average rating,
// your log with the progress tracker, and a button to log it (again).
//
// It runs in the browser (like the profile page) because in demo mode the
// data only exists in this browser's localStorage. Everything goes through
// getMediaStore(), so the same code works with Supabase.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getMediaStore, type LogWithMedia } from "@/lib/media";
import {
  averageRating,
  formatAverage,
  logProgressLabel,
  ratingToStars,
  statusLabel,
  TYPE_LABELS,
  unitsLabel,
} from "@/lib/media/display";
import { diaryDate, formatShortDate } from "@/lib/media/diary";
import type { MediaItem, MediaItemRef } from "@/lib/media/types";
import { mediaItemToResult } from "@/lib/media/validation";
import { useAuth } from "./AuthProvider";
import { LogMediaForm } from "./LogMediaForm";
import { Poster } from "./Poster";
import { ProgressTracker } from "./ProgressTracker";

// What we loaded, and for which item (same "stale answer" trick as the profile page).
type Loaded = {
  key: string;
  item: MediaItem | null; // null = nobody has logged it yet, so it isn't cached
  logs: LogWithMedia[]; // everyone's, newest first
  error: string | null;
};

const keyOf = (ref: MediaItemRef) => `${ref.type}/${ref.source}/${ref.sourceId}`;

async function loadItem(ref: MediaItemRef): Promise<Loaded> {
  const store = getMediaStore();
  const item = await store.getMediaItem(ref);
  const logs = item ? await store.getLogsForItem(item.id) : [];
  return { key: keyOf(ref), item, logs, error: null };
}

export function MediaItemView({ itemRef }: { itemRef: MediaItemRef }) {
  const { status, user, profile, profileLoading } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [logging, setLogging] = useState(false);
  const key = keyOf(itemRef);
  // `itemRef` could be a new object on every render, so the hooks below depend
  // on its three parts (plain strings) instead of the object itself.
  const { type, source, sourceId } = itemRef;

  // useCallback keeps the same function between renders (unless the item
  // changes), so the effect below doesn't re-run on every render.
  const reload = useCallback(() => {
    let cancelled = false;
    const ref = { type, source, sourceId };
    loadItem(ref)
      .then((result) => {
        if (!cancelled) setLoaded(result);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not load this item.";
        if (!cancelled) setLoaded({ key: keyOf(ref), item: null, logs: [], error: message });
      });
    // The "cleanup": if the item changes before the answer arrives, ignore the old answer.
    return () => {
      cancelled = true;
    };
  }, [type, source, sourceId]);

  useEffect(() => reload(), [reload]);

  if (!loaded || loaded.key !== key) return <p className="text-zinc-400">Loading...</p>;
  if (loaded.error) {
    return (
      <p role="alert" className="text-red-400">
        {loaded.error}
      </p>
    );
  }

  const { item, logs } = loaded;
  if (!item) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Not in Media Log yet</h1>
        <p className="mt-2 text-zinc-400">
          Nobody has logged this {TYPE_LABELS[itemRef.type].one.toLowerCase()} yet, so we don&apos;t have its details.
        </p>
        <Link href="/search" className="mt-6 inline-block text-violet-400 hover:underline">
          Search for it and be the first to log it
        </Link>
      </div>
    );
  }

  const average = averageRating(logs);
  const people = new Set(logs.map((log) => log.user_id)).size;
  // Your logs of this item, newest first. The newest one gets the tracker.
  const mine = user ? logs.filter((log) => log.user_id === user.id) : [];
  const [current, ...earlier] = mine;
  const canLog = status === "signed-in" && !profileLoading && profile !== null;
  const details = [item.creators.join(", "), unitsLabel(item.type, item.total_units)].filter(Boolean).join(" · ");

  // After the tracker saves, swap the new version into the list (no reload needed).
  function handleUpdated(updated: LogWithMedia) {
    setLoaded((previous) =>
      previous ? { ...previous, logs: previous.logs.map((log) => (log.id === updated.id ? updated : log)) } : previous,
    );
  }

  if (logging) {
    return (
      <LogMediaForm
        media={mediaItemToResult(item)}
        onSaved={() => {
          setLogging(false);
          reload();
        }}
        onCancel={() => setLogging(false)}
        cancelLabel="Cancel"
      />
    );
  }

  return (
    <div>
      {/* Header: cover + info. Stacks on phones, side by side from 640px up. */}
      <section className="flex flex-col gap-6 sm:flex-row">
        <div className="mx-auto w-40 shrink-0 sm:mx-0 sm:w-48">
          <Poster src={item.cover_url} title={item.title} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-violet-300 uppercase">{TYPE_LABELS[item.type].one}</p>
          <h1 className="text-3xl font-bold">
            {item.title} {item.year && <span className="font-normal text-zinc-400">({item.year})</span>}
          </h1>
          {details && <p className="mt-1 text-zinc-400">{details}</p>}

          <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            {average.average !== null ? (
              <p>
                <span className="text-2xl font-bold text-amber-300">★ {formatAverage(average.average)}</span>{" "}
                <span className="text-sm text-zinc-400">
                  average from {average.count} {average.count === 1 ? "rating" : "ratings"}
                </span>
              </p>
            ) : (
              <p className="text-zinc-400">No ratings yet.</p>
            )}
            <p className="mt-1 text-sm text-zinc-500">
              Logged {logs.length} {logs.length === 1 ? "time" : "times"} by {people} {people === 1 ? "person" : "people"}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold">My log</h2>
          {canLog && (
            <button
              type="button"
              onClick={() => setLogging(true)}
              className="rounded-md bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400"
            >
              {current ? "Log it again" : "Log it"}
            </button>
          )}
        </div>

        {status === "signed-out" && (
          <p className="mt-3 text-zinc-400">
            <Link href="/login" className="text-violet-400 hover:underline">
              Log in
            </Link>{" "}
            to track this.
          </p>
        )}
        {status === "signed-in" && !profileLoading && !profile && (
          <p className="mt-3 text-zinc-400">
            <Link href="/onboarding" className="text-violet-400 hover:underline">
              Pick a username
            </Link>{" "}
            to track this.
          </p>
        )}
        {canLog && !current && <p className="mt-3 text-zinc-400">You haven&apos;t logged this yet.</p>}

        {current && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
            <p className="text-sm text-zinc-400">
              {statusLabel(current.status, item.type)}
              {current.rating !== null && <span className="text-amber-300"> {ratingToStars(current.rating)}</span>}
              {current.rewatch && " · again"} · {formatShortDate(diaryDate(current))}
            </p>
            {current.review_text && <p className="mt-2 whitespace-pre-line text-zinc-200">{current.review_text}</p>}
            <div className="mt-4">
              {/* key: a different log (e.g. you just logged it again) gets a fresh tracker. */}
              <ProgressTracker key={current.id} log={current} onUpdated={handleUpdated} />
            </div>
          </div>
        )}

        {earlier.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-zinc-400">Earlier</h3>
            <ul className="mt-2 space-y-1 text-sm text-zinc-300">
              {earlier.map((log) => (
                <li key={log.id}>
                  {formatShortDate(diaryDate(log))} · {statusLabel(log.status, item.type)}
                  {log.rating !== null && <span className="text-amber-300"> {ratingToStars(log.rating)}</span>}
                  {logProgressLabel(log) && <span className="text-zinc-500"> · {logProgressLabel(log)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {profile && mine.length > 0 && (
          <p className="mt-6 text-sm">
            <Link href={`/u/${profile.username}/diary`} className="text-violet-400 hover:underline">
              See my diary
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
