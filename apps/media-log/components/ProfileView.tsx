"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuthService, type Profile } from "@/lib/auth";
import { normalizeUsername } from "@/lib/auth/validation";
import { useAuth } from "./AuthProvider";

// The media types the app will cover (shown as empty counters for now).
const MEDIA_TYPES = ["Movies", "Series", "Anime", "Manga", "Books", "Games"];

// The result of looking up a username. We keep the username we looked up next
// to the result, so after navigating to another profile we know the old
// result is stale and show "Loading" instead of the wrong person.
type Lookup = { username: string; profile: Profile | null; error: string | null };

export function ProfileView({ username }: { username: string }) {
  const { user } = useAuth();
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const wanted = normalizeUsername(username);

  useEffect(() => {
    let cancelled = false;
    getAuthService()
      .getProfileByUsername(wanted)
      .then((profile) => {
        if (!cancelled) setLookup({ username: wanted, profile, error: null });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not load this profile.";
        if (!cancelled) setLookup({ username: wanted, profile: null, error: message });
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
            <div className="text-2xl font-bold">0</div>
            <div className="text-xs text-zinc-400">{type}</div>
          </div>
        ))}
      </section>

      <section className="mt-10 rounded-lg border border-dashed border-zinc-700 p-10 text-center">
        <h2 className="text-lg font-semibold">Nothing logged yet</h2>
        <p className="mt-2 text-zinc-400">
          {isMe
            ? "Soon you'll search for a movie, rate it and see it here. (That's Stage 2!)"
            : `@${profile.username} hasn't logged anything yet.`}
        </p>
      </section>
    </div>
  );
}
