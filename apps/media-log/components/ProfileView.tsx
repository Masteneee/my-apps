"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuthService, type Profile } from "@/lib/auth";
import { normalizeUsername } from "@/lib/auth/validation";
import { getMediaStore, type LogWithMedia } from "@/lib/media";
import { countByType, groupByType, latestLogPerItem, TYPE_LABELS } from "@/lib/media/display";
import { MEDIA_TYPES } from "@/lib/media/types";
import { useAuth } from "./AuthProvider";
import { PosterGrid } from "./PosterGrid";

// The result of looking up a username. We keep the username we looked up next
// to the result, so after navigating to another profile we know the old
// result is stale and show "Loading" instead of the wrong person.
type Lookup = {
  username: string;
  profile: Profile | null;
  logs: LogWithMedia[]; // newest first
  error: string | null; // the profile itself couldn't load
  logsError: string | null; // the profile loaded, but its logs didn't
};

// Loads the profile, then (if it exists) its logs. Kept outside the component
// because it doesn't need any React state.
async function loadProfilePage(username: string): Promise<Lookup> {
  const profile = await getAuthService().getProfileByUsername(username);
  if (!profile) return { username, profile: null, logs: [], error: null, logsError: null };
  try {
    const logs = await getMediaStore().getLogsForUser(profile.id);
    return { username, profile, logs, error: null, logsError: null };
  } catch (err) {
    // e.g. the Stage 2 tables don't exist yet: still show the profile, plus the reason.
    const message = err instanceof Error ? err.message : "Could not load the logs.";
    return { username, profile, logs: [], error: null, logsError: message };
  }
}

export function ProfileView({ username }: { username: string }) {
  const { user } = useAuth();
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const wanted = normalizeUsername(username);

  useEffect(() => {
    let cancelled = false;
    loadProfilePage(wanted)
      .then((result) => {
        if (!cancelled) setLookup(result);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not load this profile.";
        if (!cancelled) setLookup({ username: wanted, profile: null, logs: [], error: message, logsError: null });
      });
    return () => {
      cancelled = true;
    };
  }, [wanted]);

  // Still loading (or loading a different username after navigation).
  if (!lookup || lookup.username !== wanted) {
    return <p className="text-zinc-400">Loading profile...</p>;
  }

  if (lookup.error) {
    return <p className="text-red-400">{lookup.error}</p>;
  }

  const profile = lookup.profile;
  if (!profile) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">No one here yet</h1>
        <p className="mt-2 text-zinc-400">There is no user called @{wanted}.</p>
        <Link href="/" className="mt-6 inline-block text-violet-400 hover:underline">
          Back home
        </Link>
      </div>
    );
  }

  const isMe = user?.id === profile.id;
  const name = profile.display_name || profile.username;
  // Each item once (its most recent log), split by type, and how many of each type.
  const groups = groupByType(latestLogPerItem(lookup.logs));
  const counts = countByType(lookup.logs);

  return (
    <div>
      {/* Header: stacks on phones, side by side from the "sm" breakpoint (640px) up. */}
      <section className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        {/* Placeholder avatar: the first letter of the name. Real avatars come later. */}
        <div
          aria-hidden="true"
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-fuchsia-600 text-4xl font-bold uppercase"
        >
          {name.charAt(0)}
        </div>
        <div>
          <h1 className="text-3xl font-bold">{name}</h1>
          <p className="text-zinc-400">@{profile.username}</p>
          <p className="mt-2 max-w-prose text-zinc-300">
            {profile.bio || (isMe ? "No bio yet. You'll be able to add one later." : "No bio yet.")}
          </p>
          {isMe && (
            <span className="mt-3 inline-block rounded-full bg-violet-500/15 px-3 py-1 text-xs text-violet-300">
              This is you
            </span>
          )}
        </div>
      </section>

      {/* One counter per media type. grid-cols-3 on phones, 6 in a row on wider screens. */}
      <section className="mt-10 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {MEDIA_TYPES.map((type) => (
          <div key={type} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-center">
            <div className="text-2xl font-bold">{counts[type]}</div>
            <div className="text-xs text-zinc-400">{TYPE_LABELS[type].many}</div>
          </div>
        ))}
      </section>

      {lookup.logsError && (
        <p role="alert" className="mt-6 text-sm text-red-400">
          {lookup.logsError}
        </p>
      )}

      {groups.length > 0 ? (
        <>
          {isMe && (
            <p className="mt-8 text-right">
              <Link href="/search" className="text-sm text-violet-400 hover:underline">
                Log something else
              </Link>
            </p>
          )}
          {/* One section per media type that has something in it. */}
          {groups.map((group) => (
            <section key={group.type} className="mt-6">
              <h2 className="mb-4 text-xl font-semibold">
                {TYPE_LABELS[group.type].many} <span className="text-base font-normal text-zinc-500">{group.logs.length}</span>
              </h2>
              <PosterGrid logs={group.logs} />
            </section>
          ))}
        </>
      ) : (
        <section className="mt-10 rounded-lg border border-dashed border-zinc-700 p-10 text-center">
          <h2 className="text-lg font-semibold">Nothing logged yet</h2>
          {isMe ? (
            <p className="mt-2 text-zinc-400">
              <Link href="/search" className="text-violet-400 hover:underline">
                Search a movie, anime, book or game
              </Link>
              , rate it, and it shows up here.
            </p>
          ) : (
            <p className="mt-2 text-zinc-400">@{profile.username} hasn&apos;t logged anything yet.</p>
          )}
        </section>
      )}
    </div>
  );
}
