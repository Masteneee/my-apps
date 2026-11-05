"use client";
// The "New list" form on your lists page. The rules (title needed, lengths)
// are checked by the store with validateListInput() (lib/media/lists.ts).

import { useState } from "react";
import { getMediaStore } from "@/lib/media";
import { LIST_DESCRIPTION_MAX, LIST_TITLE_MAX } from "@/lib/media/lists";
import type { MediaList } from "@/lib/media/types";

export function NewListForm({ onCreated }: { onCreated: (list: MediaList) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault(); // stop the browser from reloading the page
    setBusy(true);
    setError(null);
    try {
      const list = await getMediaStore().createList({ title, description, isPublic });
      setTitle("");
      setDescription("");
      onCreated(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the list.");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none placeholder:text-zinc-600 focus:border-violet-400";

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
      <h2 className="text-lg font-semibold">New list</h2>
      <label htmlFor="list-title" className="mt-3 block text-sm font-medium text-zinc-300">
        Title
      </label>
      <input
        id="list-title"
        value={title}
        maxLength={LIST_TITLE_MAX}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Best anime for people who don't watch anime"
        className={input}
      />
      <label htmlFor="list-description" className="mt-3 block text-sm font-medium text-zinc-300">
        Description <span className="text-zinc-500">(optional)</span>
      </label>
      <textarea
        id="list-description"
        rows={2}
        value={description}
        maxLength={LIST_DESCRIPTION_MAX}
        onChange={(e) => setDescription(e.target.value)}
        className={input}
      />
      <label className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="h-4 w-4 accent-violet-500"
        />
        Public (anyone can see it). Unticked = only you.
      </label>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded-md bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-60"
      >
        {busy ? "Creating..." : "Create list"}
      </button>
    </form>
  );
}
