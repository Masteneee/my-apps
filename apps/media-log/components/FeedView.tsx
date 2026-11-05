"use client";
// The home feed /feed: what the people you follow logged and reviewed, newest
// first, with likes. Plus "People to follow", and in demo mode a button that
// adds 3 made-up demo people (lib/demo/seed.ts) so there is someone to follow.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { authMode, getAuthService, type Profile } from "@/lib/auth";
import { DEMO_PASSWORD, DEMO_PEOPLE, hasDemoPeople, seedDemoPeople } from "@/lib/demo/seed";
import { getMediaStore, type SocialLog } from "@/lib/media";
import { applyLikeChange, displayName } from "@/lib/media/feed";
import { useAuth } from "./AuthProvider";
import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";
import { SocialLogCard } from "./SocialLogCard";

type Loaded = {
  userId: string; // whose feed this is (stale if someone else logs in)
  feed: SocialLog[];
  following: string[];
  people: Profile[]; // everyone else, newest accounts first
  demoSeeded: boolean;
  error: string | null;
};

async function loadFeed(userId: string): Promise<Loaded> {
  const store = getMediaStore();
  // Promise.all runs the three requests at the same time instead of one after the other.
  const [feed, following, profiles] = await Promise.all([
    store.getFeed(),
    store.getFollowing(userId),
    getAuthService().listProfiles(20),
  ]);
  return {
    userId,
    feed,
    following,
    people: profiles.filter((profile) => profile.id !== userId),
    // localStorage only exists in the browser, so we read it here (in the effect), not while rendering.
    demoSeeded: authMode === "mock" && hasDemoPeople(window.localStorage),
    error: null,
  };
}

export function FeedView() {
  const { status, user, profile, profileLoading } = useAuth();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const userId = user?.id ?? null;

  const reload = useCallback(() => {
    if (!userId) return;
    let cancelled = false;
    loadFeed(userId)
      .then((result) => {
        if (!cancelled) setLoaded(result);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not load your feed.";
        if (!cancelled) setLoaded({ userId, feed: [], following: [], people: [], demoSeeded: false, error: message });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => reload(), [reload]);

  if (status === "loading" || profileLoading) return <p className="text-zinc-400">Loading...</p>;
  if (status === "signed-out") {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">Your feed</h1>
        <p className="mt-2 text-zinc-400">
          <Link href="/login" className="text-violet-400 hover:underline">
            Log in
          </Link>{" "}
          to see what the people you follow are watching, reading and playing.
        </p>
      </div>
    );
  }
  if (!profile) {
    return (
      <p className="text-zinc-400">
        <Link href="/onboarding" className="text-violet-400 hover:underline">
          Pick a username
        </Link>{" "}
        first.
      </p>
    );
  }
  if (!loaded || loaded.userId !== userId) return <p className="text-zinc-400">Loading your feed...</p>;

  function addDemoPeople() {
    setSeedError(null);
    try {
      seedDemoPeople(window.localStorage);
      reload();
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : "Could not add the demo people.");
    }
  }

  function handleFollowChange() {
    // Following someone changes the feed itself, so load everything again.
    reload();
  }

  const following = new Set(loaded.following);

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_16rem]">
      <section className="min-w-0">
        <h1 className="text-3xl font-bold">Feed</h1>
        <p className="mt-1 text-zinc-400">What the people you follow logged and reviewed, newest first.</p>

        {loaded.error && (
          <p role="alert" className="mt-6 text-sm text-red-400">
            {loaded.error}
          </p>
        )}

        {loaded.feed.length === 0 && !loaded.error ? (
          <p className="mt-8 rounded-lg border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
            {following.size === 0
              ? "You don't follow anyone yet. Pick someone under “People to follow”."
              : "The people you follow haven't logged anything yet."}
          </p>
        ) : (
          <div className="mt-4 divide-y divide-zinc-800">
            {loaded.feed.map((log) => (
              <SocialLogCard
                key={log.id}
                log={log}
                onLikeChange={(change) =>
                  setLoaded((previous) =>
                    previous ? { ...previous, feed: applyLikeChange(previous.feed, log.id, change) } : previous,
                  )
                }
              />
            ))}
          </div>
        )}
      </section>

      <aside>
        {authMode === "mock" && (
          // Clearly labeled: this box only exists in demo mode.
          <div className="mb-8 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
            <p className="font-semibold">Demo mode</p>
            {loaded.demoSeeded ? (
              <p className="mt-1 text-amber-100/80">
                Demo people added: {DEMO_PEOPLE.map((p) => p.username).join(", ")}. To act as one of them (for
                example to like a review YOU wrote), log out and log in as <code>{DEMO_PEOPLE[0].email}</code>, password{" "}
                <code>{DEMO_PASSWORD}</code>.
              </p>
            ) : (
              <>
                <p className="mt-1 text-amber-100/80">
                  You&apos;re the only person in this browser. Add 3 made-up demo people with logs, reviews, likes and a
                  list, so there is someone to follow.
                </p>
                <button
                  type="button"
                  onClick={addDemoPeople}
                  className="mt-3 rounded-md bg-amber-400 px-3 py-1.5 font-medium text-zinc-950 hover:bg-amber-300"
                >
                  Add demo people
                </button>
              </>
            )}
            {seedError && (
              <p role="alert" className="mt-2 text-red-300">
                {seedError}
              </p>
            )}
          </div>
        )}

        <h2 className="text-lg font-semibold">People to follow</h2>
        {loaded.people.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">Nobody else has a profile yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {loaded.people.map((person) => (
              <li key={person.id} className="flex items-center gap-3">
                <Avatar name={displayName(person)} />
                <Link href={`/u/${person.username}`} className="min-w-0 flex-1 truncate text-sm hover:underline">
                  <span className="font-medium">{displayName(person)}</span>
                  <span className="block truncate text-xs text-zinc-500">@{person.username}</span>
                </Link>
                <FollowButton userId={person.id} following={following.has(person.id)} onChange={handleFollowChange} />
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
