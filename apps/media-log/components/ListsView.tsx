"use client";
// /u/[username]/lists: someone's lists. You see all of yours (public and
// private) plus a "New list" form; other people only see the public ones.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAuthService, type Profile } from "@/lib/auth";
import { normalizeUsername } from "@/lib/auth/validation";
import { getMediaStore, type ListWithItems } from "@/lib/media";
import { itemCountLabel } from "@/lib/media/lists";
import { useAuth } from "./AuthProvider";
import { NewListForm } from "./NewListForm";
import { Poster } from "./Poster";

type Loaded = { username: string; profile: Profile | null; lists: ListWithItems[]; error: string | null };

async function loadLists(username: string): Promise<Loaded> {
  const profile = await getAuthService().getProfileByUsername(username);
  if (!profile) return { username, profile: null, lists: [], error: null };
  return { username, profile, lists: await getMediaStore().getListsForUser(profile.id), error: null };
}

export function ListsView({ username }: { username: string }) {
  const { user, status } = useAuth();
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const wanted = normalizeUsername(username);
  // Signing in or out changes which lists we may see (private ones), so reload then too.
  const viewer = user?.id ?? null;

  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    loadLists(wanted)
      .then((result) => {
        if (!cancelled) setLoaded(result);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not load the lists.";
        if (!cancelled) setLoaded({ username: wanted, profile: null, lists: [], error: message });
      });
    return () => {
      cancelled = true;
    };
  }, [wanted, viewer, status]);

  if (!loaded || loaded.username !== wanted) return <p className="text-zinc-400">Loading lists...</p>;
  if (loaded.error) return <p className="text-red-400">{loaded.error}</p>;
  const profile = loaded.profile;
  if (!profile) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">No one here yet</h1>
        <p className="mt-2 text-zinc-400">There is no user called @{wanted}.</p>
      </div>
    );
  }
  const isMe = user?.id === profile.id;

  return (
    <div>
      <p className="text-sm">
        <Link href={`/u/${profile.username}`} className="text-violet-400 hover:underline">
          ← @{profile.username}
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-bold">{isMe ? "My lists" : `${profile.display_name || profile.username}'s lists`}</h1>

      {isMe && (
        <div className="mt-6">
          {/* A new list starts empty, so go straight to its page to fill it. */}
          <NewListForm onCreated={(list) => router.push(`/lists/${list.id}`)} />
        </div>
      )}

      {loaded.lists.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
          {isMe ? "You have no lists yet." : `@${profile.username} has no public lists yet.`}
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {loaded.lists.map((list) => (
            <li key={list.id}>
              <Link
                href={`/lists/${list.id}`}
                className="block rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-600"
              >
                {/* The first 4 covers, side by side, like a Letterboxd list preview. */}
                <div className="grid grid-cols-4 gap-1.5">
                  {list.items.slice(0, 4).map((item) => (
                    <Poster key={item.media_item_id} src={item.media.cover_url} title={item.media.title} sizes="(min-width: 640px) 120px, 25vw" />
                  ))}
                </div>
                <h2 className="mt-3 font-semibold">{list.title}</h2>
                <p className="text-xs text-zinc-500">
                  {itemCountLabel(list.items.length)}
                  {!list.is_public && " · Private"}
                </p>
                {list.description && <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{list.description}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
