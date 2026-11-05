"use client";
// /lists/[id]: one list, in order. Its owner can reorder it three ways:
// - drag and drop with the mouse (the browser's built-in "HTML drag and drop"),
// - the ↑ / ↓ buttons (phones, where native drag doesn't work well, and the keyboard),
// and can remove items, add new ones, or delete the whole list.
// The order math is in the pure functions of lib/media/reorder.ts.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getMediaStore, type ListWithItems } from "@/lib/media";
import { TYPE_LABELS } from "@/lib/media/display";
import { displayName } from "@/lib/media/feed";
import { mediaItemPath } from "@/lib/media/links";
import { itemCountLabel } from "@/lib/media/lists";
import { moveDown, moveItem, moveUp } from "@/lib/media/reorder";
import type { ListItemWithMedia } from "@/lib/media/types";
import { useAuth } from "./AuthProvider";
import { ListAddSearch } from "./ListAddSearch";
import { Poster } from "./Poster";

type Loaded = { listId: string; list: ListWithItems | null; error: string | null };

export function ListView({ listId }: { listId: string }) {
  const { user, status } = useAuth();
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Drag and drop: which row is being dragged, and which row it's over.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const viewer = user?.id ?? null;

  useEffect(() => {
    if (status === "loading") return; // wait to know who is looking (private lists)
    let cancelled = false;
    getMediaStore()
      .getList(listId)
      .then((list) => {
        if (!cancelled) setLoaded({ listId, list, error: null });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not load this list.";
        if (!cancelled) setLoaded({ listId, list: null, error: message });
      });
    return () => {
      cancelled = true;
    };
  }, [listId, viewer, status]);

  if (!loaded || loaded.listId !== listId) return <p className="text-zinc-400">Loading list...</p>;
  if (loaded.error) {
    return (
      <p role="alert" className="text-red-400">
        {loaded.error}
      </p>
    );
  }
  const list = loaded.list;
  if (!list) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">List not found</h1>
        <p className="mt-2 text-zinc-400">This list doesn&apos;t exist, or it&apos;s private.</p>
      </div>
    );
  }
  const isOwner = viewer === list.user_id;
  const items = list.items;

  const showList = (next: ListWithItems) => setLoaded({ listId, list: next, error: null });

  /**
   * Saves a new order. The screen changes right away ("optimistic"), then we
   * save; if saving fails, the old order comes back with the reason.
   */
  async function saveOrder(next: ListItemWithMedia[]) {
    if (!list || next.every((item, i) => item.media_item_id === items[i].media_item_id)) return; // nothing moved
    const before = list;
    showList({ ...list, items: next });
    setSaving(true);
    setError(null);
    try {
      showList(await getMediaStore().reorderList(list.id, next.map((item) => item.media_item_id)));
    } catch (err) {
      showList(before);
      setError(err instanceof Error ? err.message : "Could not save the new order.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: ListItemWithMedia) {
    if (!list) return;
    setError(null);
    try {
      showList(await getMediaStore().removeFromList(list.id, item.media_item_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove it.");
    }
  }

  async function deleteList() {
    if (!list) return;
    // confirm() shows the browser's own "OK / Cancel" box. Deleting can't be undone.
    if (!window.confirm(`Delete the list "${list.title}"? This can't be undone.`)) return;
    try {
      await getMediaStore().deleteList(list.id);
      router.push(`/u/${list.author.username}/lists`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the list.");
    }
  }

  function endDrag() {
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <div>
      <p className="text-sm">
        <Link href={`/u/${list.author.username}/lists`} className="text-violet-400 hover:underline">
          ← {isOwner ? "My lists" : `${displayName(list.author)}'s lists`}
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-bold">{list.title}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        by{" "}
        <Link href={`/u/${list.author.username}`} className="text-zinc-300 hover:underline">
          {displayName(list.author)}
        </Link>{" "}
        · {itemCountLabel(items.length)} · {list.is_public ? "Public" : "Private (only you)"}
      </p>
      {list.description && <p className="mt-3 max-w-prose whitespace-pre-line text-zinc-300">{list.description}</p>}

      {isOwner && (
        <div className="mt-6">
          <ListAddSearch list={list} onAdded={showList} />
          {items.length > 1 && (
            <p className="mt-3 text-sm text-zinc-500">
              Drag a row to move it, or use the ↑ ↓ buttons. {saving && <span className="text-violet-300">Saving...</span>}
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-zinc-700 p-8 text-center text-zinc-400">
          {isOwner ? "This list is empty. Search above to add something." : "This list is empty."}
        </p>
      ) : (
        <ol className="mt-6 divide-y divide-zinc-800">
          {items.map((item, index) => (
            <li
              key={item.media_item_id}
              // Only the owner can drag, and not while a save is running.
              draggable={isOwner && !saving}
              onDragStart={(event) => {
                setDragIndex(index);
                event.dataTransfer.effectAllowed = "move";
                // Firefox only starts a drag if some data is attached.
                event.dataTransfer.setData("text/plain", item.media.title);
              }}
              onDragOver={(event) => {
                if (dragIndex === null) return; // something else is dragged (a file, text...)
                // By default a page refuses drops; preventDefault() says "you can drop here".
                event.preventDefault();
                setOverIndex(index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragIndex !== null) saveOrder(moveItem(items, dragIndex, index));
                endDrag();
              }}
              onDragEnd={endDrag}
              className={`flex items-center gap-3 py-3 ${isOwner ? "cursor-grab active:cursor-grabbing" : ""} ${
                dragIndex === index ? "opacity-40" : ""
              } ${overIndex === index && dragIndex !== index ? "border-t-2 border-t-violet-400" : ""}`}
            >
              <span className="w-7 shrink-0 text-center text-lg font-bold text-zinc-500">{index + 1}</span>
              <Link href={mediaItemPath(item.media)} className="w-12 shrink-0" draggable={false}>
                <Poster src={item.media.cover_url} title={item.media.title} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={mediaItemPath(item.media)} className="font-medium hover:underline" draggable={false}>
                  {item.media.title}
                </Link>
                {item.media.year && <span className="text-sm text-zinc-500"> {item.media.year}</span>}
                <p className="text-sm text-violet-300">{TYPE_LABELS[item.media.type].one}</p>
                {item.note && <p className="mt-1 text-sm text-zinc-300">{item.note}</p>}
              </div>
              {isOwner && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => saveOrder(moveUp(items, index))}
                    disabled={saving || index === 0}
                    aria-label={`Move ${item.media.title} up`}
                    className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => saveOrder(moveDown(items, index))}
                    disabled={saving || index === items.length - 1}
                    aria-label={`Move ${item.media.title} down`}
                    className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    disabled={saving}
                    aria-label={`Remove ${item.media.title} from the list`}
                    className="rounded-md px-2.5 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-red-300 disabled:opacity-30"
                  >
                    ✕
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {isOwner && (
        <button
          type="button"
          onClick={deleteList}
          className="mt-10 rounded-md border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10"
        >
          Delete this list
        </button>
      )}
    </div>
  );
}
