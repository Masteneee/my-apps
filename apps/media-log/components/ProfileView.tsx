"use client";

import Link from "next/link";
import { countByType, groupByType, latestLogPerItem, TYPE_LABELS } from "@/lib/media/display";
import { MEDIA_TYPES } from "@/lib/media/types";
import { useAuth } from "./AuthProvider";
import { PosterGrid } from "./PosterGrid";
import { useProfileLogs } from "./useProfileLogs";

export function ProfileView({ username }: { username: string }) {
  const { user } = useAuth();
  // Loading the profile and its logs is shared with the diary page (see useProfileLogs.ts).
  const { wanted, lookup } = useProfileLogs(username);

  // Still loading (or loading a different username after navigation).
  if (!lookup) {
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
          <p className="mt-8 flex justify-end gap-4 text-sm">
            <Link href={`/u/${profile.username}/diary`} className="text-violet-400 hover:underline">
              Diary
            </Link>
            {isMe && (
              <Link href="/search" className="text-violet-400 hover:underline">
                Log something else
              </Link>
            )}
          </p>
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
