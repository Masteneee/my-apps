"use client";
// "Add to list" on an item page: pick one of your lists, press Add.

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMediaStore, type ListWithItems, type MediaResult } from "@/lib/media";

type Props = { media: MediaResult; mediaItemId: string; userId: string; username: string };

export function AddToList({ media, mediaItemId, userId, username }: Props) {
  const [lists, setLists] = useState<ListWithItems[] | null>(null);
  const [chosen, setChosen] = useState("");
  const [message, setMessage] = useState<{ text: string; listId?: string; error?: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMediaStore()
      .getListsForUser(userId)
      .then((mine) => {
        if (!cancelled) setLists(mine);
      })
      .catch(() => {
        if (!cancelled) setLists([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (lists === null) return null; // still loading: show nothing rather than flicker
  if (lists.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        <Link href={`/u/${username}/lists`} className="text-violet-400 hover:underline">
          Make a list
        </Link>{" "}
        to collect things like this one.
      </p>
    );
  }

  // Lists that already have this item can't take it again (the database's primary key).
  const hasIt = (list: ListWithItems) => list.items.some((item) => item.media_item_id === mediaItemId);
  // Default to the first list that doesn't have it yet.
  const selected = chosen || lists.find((list) => !hasIt(list))?.id || "";

  async function add() {
    if (!selected) return;
    try {
      const updated = await getMediaStore().addToList(selected, media);
      setLists((previous) => previous && previous.map((list) => (list.id === updated.id ? updated : list)));
      setChosen("");
      setMessage({ text: `Added to "${updated.title}".`, listId: updated.id });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Could not add it.", error: true });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor="add-to-list" className="text-zinc-300">
        Add to list
      </label>
      <select
        id="add-to-list"
        value={selected}
        onChange={(e) => setChosen(e.target.value)}
        className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 outline-none focus:border-violet-400"
      >
        {lists.map((list) => (
          <option key={list.id} value={list.id} disabled={hasIt(list)}>
            {list.title}
            {hasIt(list) ? " (already in it)" : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={add}
        disabled={!selected || lists.every(hasIt)}
        className="rounded-md border border-zinc-700 px-3 py-1.5 hover:bg-zinc-800 disabled:opacity-50"
      >
        Add
      </button>
      {message && (
        <span role={message.error ? "alert" : "status"} className={message.error ? "text-red-400" : "text-green-400"}>
          {message.text}{" "}
          {message.listId && (
            <Link href={`/lists/${message.listId}`} className="text-violet-400 hover:underline">
              Open it
            </Link>
          )}
        </span>
      )}
    </div>
  );
}
