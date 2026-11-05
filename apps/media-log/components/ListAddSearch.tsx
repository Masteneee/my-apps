"use client";
// On your own list page: a small search box to add items to the list without
// logging them first. It asks the same /api/search as the search page.

import { useState } from "react";
import { getMediaStore, type ListWithItems, type MediaResult } from "@/lib/media";
import { TYPE_LABELS } from "@/lib/media/display";
import type { UnifiedSearchResponse } from "@/lib/sources/types";
import { Poster } from "./Poster";

type Props = { list: ListWithItems; onAdded: (list: ListWithItems) => void };

// Same "is it already there?" rule as the database's primary key, from the search result side.
const sameItem = (result: MediaResult, list: ListWithItems) =>
  list.items.some(
    (item) =>
      item.media.source === result.source && item.media.type === result.type && item.media.source_id === result.sourceId,
  );

export function ListAddSearch({ list, onAdded }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: query, type: "all" });
      const response = await fetch(`/api/search?${params.toString()}`);
      if (!response.ok) throw new Error(`Search failed (error ${response.status}).`);
      const answer = (await response.json()) as UnifiedSearchResponse;
      setResults(answer.results.slice(0, 8)); // a short list is enough here
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  async function add(result: MediaResult) {
    setError(null);
    try {
      onAdded(await getMediaStore().addToList(list.id, result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add it.");
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <form onSubmit={search} className="flex gap-2">
        <label htmlFor="list-add-search" className="sr-only">
          Search something to add
        </label>
        <input
          id="list-add-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add a movie, anime, book, game..."
          className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none placeholder:text-zinc-600 focus:border-violet-400"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-60"
        >
          {busy ? "..." : "Search"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      )}
      {results && results.length === 0 && <p className="mt-3 text-sm text-zinc-400">Nothing found.</p>}
      {results && results.length > 0 && (
        <ul className="mt-3 divide-y divide-zinc-800">
          {results.map((result) => {
            const already = sameItem(result, list);
            return (
              <li key={`${result.source}-${result.type}-${result.sourceId}`} className="flex items-center gap-3 py-2">
                <div className="w-8 shrink-0">
                  <Poster src={result.coverUrl} title={result.title} sizes="32px" />
                </div>
                <p className="min-w-0 flex-1 truncate text-sm">
                  {result.title} <span className="text-zinc-500">{result.year}</span>
                  <span className="block text-xs text-violet-300">{TYPE_LABELS[result.type].one}</span>
                </p>
                <button
                  type="button"
                  disabled={already}
                  onClick={() => add(result)}
                  className="rounded-md border border-zinc-700 px-3 py-1 text-sm hover:bg-zinc-800 disabled:opacity-50"
                >
                  {already ? "Added" : "Add"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
