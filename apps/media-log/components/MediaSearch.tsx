"use client";
// The /search page: ONE search box for every media type, filter chips, the
// merged results, and the log form. (In Stage 2 this was MovieSearch.)
// The search itself happens on OUR server (/api/search), which talks to TMDB,
// AniList, Open Library and IGDB, so no key ever reaches the browser.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ratingToStars, statusLabel, TYPE_LABELS, unitsLabel } from "@/lib/media/display";
import { mediaItemPath } from "@/lib/media/links";
import type { LogWithMedia, MediaResult } from "@/lib/media";
import { SEARCH_FILTERS, type SearchFilter, type SourceStatus, type UnifiedSearchResponse } from "@/lib/sources/types";
import { useAuth } from "./AuthProvider";
import { LogMediaForm } from "./LogMediaForm";
import { Poster } from "./Poster";

async function fetchSearch(query: string, filter: SearchFilter): Promise<UnifiedSearchResponse> {
  // URLSearchParams turns spaces, "&", accents... into URL-safe text.
  const params = new URLSearchParams({ q: query, type: filter });
  const response = await fetch(`/api/search?${params.toString()}`);
  if (!response.ok) throw new Error(`Search failed (error ${response.status}).`);
  return (await response.json()) as UnifiedSearchResponse;
}

const FILTER_LABELS: Record<SearchFilter, string> = {
  all: "All",
  movie: "Movies",
  series: "Series",
  anime: "Anime",
  manga: "Manga",
  book: "Books",
  game: "Games",
};

const SAMPLE_REASONS = {
  "no-key": "no key set",
  forced: "MEDIA_LOG_USE_SAMPLES is on",
  "live-failed": "couldn't reach it",
} as const;

// What the last finished search looked for, and what came back.
type SearchState = { query: string; filter: SearchFilter; results: MediaResult[]; error: string | null };

export function MediaSearch() {
  const { status, profile, profileLoading } = useAuth();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [search, setSearch] = useState<SearchState | null>(null);
  // How each source did in the last answer (live, sample, error).
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<MediaResult | null>(null);
  const [saved, setSaved] = useState<LogWithMedia | null>(null);
  // Counts searches, so a slow old answer can't replace a newer one.
  // useRef keeps a value between renders WITHOUT redrawing when it changes.
  const latestRequest = useRef(0);

  // On page load, ask the server with an empty search just to learn which
  // sources use sample data, so the note shows before the first search.
  useEffect(() => {
    fetchSearch("", "all")
      .then((data) => setSources(data.sources))
      .catch(() => {}); // not important: the first real search will tell us
  }, []);

  async function runSearch(wanted: string, wantedFilter: SearchFilter) {
    const requestNumber = ++latestRequest.current;
    setBusy(true);
    setSaved(null);
    setSelected(null);
    try {
      const data = await fetchSearch(wanted, wantedFilter);
      if (requestNumber !== latestRequest.current) return; // a newer search started, ignore this one
      setSources(data.sources);
      setSearch({ query: wanted, filter: wantedFilter, results: data.results, error: null });
    } catch {
      if (requestNumber !== latestRequest.current) return;
      setSearch({ query: wanted, filter: wantedFilter, results: [], error: "Search failed. Is the app still running?" });
    } finally {
      if (requestNumber === latestRequest.current) setBusy(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const wanted = query.trim();
    if (wanted) runSearch(wanted, filter);
  }

  // Changing the filter re-runs the last search right away (no need to press Search again).
  function changeFilter(next: SearchFilter) {
    setFilter(next);
    if (search) runSearch(search.query, next);
  }

  function handleSaved(log: LogWithMedia) {
    setSaved(log);
    setSelected(null);
  }

  // Only someone signed in WITH a username can log (logs belong to a profile).
  const canLog = status === "signed-in" && !profileLoading && profile !== null;
  const sampleSources = sources.filter((s) => s.state === "sample");
  const failedSources = sources.filter((s) => s.state === "error");

  return (
    <div>
      <h1 className="text-3xl font-bold">Search</h1>
      <p className="mt-1 text-zinc-400">Movies, series, anime, manga, books and games, all in one place.</p>

      {sampleSources.length > 0 && (
        <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <strong>Sample data</strong> for{" "}
          {sampleSources.map((s, i) => (
            <span key={s.source}>
              {i > 0 && ", "}
              {s.label} ({s.sampleReason ? SAMPLE_REASONS[s.sampleReason] : "sample"})
            </span>
          ))}
          . Those sources only know a few saved titles (try <em>Dune</em>, <em>Attack on Titan</em>,{" "}
          <em>Witcher</em> or <em>Spirited Away</em>). See the README to connect the real APIs.
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6" role="search">
        {/* fieldset + legend groups the filter chips under one label for screen readers. */}
        <fieldset>
          <legend className="sr-only">Media type</legend>
          <div className="flex flex-wrap gap-2">
            {SEARCH_FILTERS.map((value) => (
              <label
                key={value}
                className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm has-focus-visible:ring-2 has-focus-visible:ring-violet-400 ${
                  filter === value
                    ? "border-violet-400 bg-violet-500/20 text-violet-200"
                    : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {/* The real radio is hidden (sr-only) but still works with the keyboard. */}
                <input
                  type="radio"
                  name="type"
                  value={value}
                  checked={filter === value}
                  onChange={() => changeFilter(value)}
                  className="sr-only"
                />
                {FILTER_LABELS[value]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="media-query" className="sr-only">
            Title
          </label>
          <input
            id="media-query"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a title, e.g. Dune"
            maxLength={100}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2.5 outline-none placeholder:text-zinc-600 focus:border-violet-400"
          />
          <button
            type="submit"
            disabled={busy || !query.trim()}
            className="rounded-md bg-violet-500 px-5 py-2.5 font-medium text-white hover:bg-violet-400 disabled:opacity-60"
          >
            {busy ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      {failedSources.length > 0 && (
        <ul role="alert" className="mt-4 space-y-1 text-sm text-red-400">
          {failedSources.map((s) => (
            <li key={s.source}>
              <strong>{s.label}:</strong> {s.error}
            </li>
          ))}
        </ul>
      )}

      {/* aria-live: screen readers read out this message when it changes. */}
      <div aria-live="polite">
        {saved && (
          <p className="mt-6 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Logged <strong>{saved.media.title}</strong> as &ldquo;{statusLabel(saved.status, saved.media.type)}&rdquo;
            {saved.rating !== null && ` ${ratingToStars(saved.rating)}`}.{" "}
            <Link href={mediaItemPath(saved.media)} className="font-medium underline">
              Open its page
            </Link>
            {profile && " · "}
            {profile && (
              <Link href={`/u/${profile.username}`} className="font-medium underline">
                See it on your profile
              </Link>
            )}
          </p>
        )}
      </div>

      {selected ? (
        <div className="mt-6">
          <LogMediaForm media={selected} onSaved={handleSaved} onCancel={() => setSelected(null)} />
        </div>
      ) : (
        <SearchResults search={search} canLog={canLog} signedIn={status === "signed-in"} onPick={setSelected} />
      )}

      {/* TMDB's terms ask apps that use its data to say so; the others ask for a credit too. */}
      <p className="mt-12 text-xs text-zinc-500">
        Data and images come from TMDB (movies, series), AniList (anime, manga), Open Library (books) and IGDB
        (games). This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
    </div>
  );
}

type ResultsProps = {
  search: SearchState | null;
  canLog: boolean;
  signedIn: boolean;
  onPick: (media: MediaResult) => void;
};

function SearchResults({ search, canLog, signedIn, onPick }: ResultsProps) {
  if (!search) return null;
  if (search.error) {
    return (
      <p role="alert" className="mt-6 text-red-400">
        {search.error}
      </p>
    );
  }
  if (search.results.length === 0) {
    const what = search.filter === "all" ? "Nothing" : `No ${FILTER_LABELS[search.filter].toLowerCase()}`;
    return (
      <p className="mt-6 text-zinc-400">
        {what} found for &ldquo;{search.query}&rdquo;.
      </p>
    );
  }

  return (
    <ul className="mt-6 space-y-3">
      {search.results.map((item) => {
        // "Studio Ghibli · 1 episode", "Frank Herbert · 604 pages"...
        const details = [item.creators.join(", "), unitsLabel(item.type, item.totalUnits)].filter(Boolean).join(" · ");
        return (
          <li
            // type is part of the key: TMDB movie 550 and series 550 are different things.
            key={`${item.source}-${item.type}-${item.sourceId}`}
            className="flex gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3"
          >
            <div className="w-16 shrink-0 sm:w-20">
              <Poster src={item.coverUrl} title={item.title} sizes="80px" />
            </div>
            {/* min-w-0 lets long titles wrap instead of pushing the layout wider than the phone. */}
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="text-xs font-medium tracking-wide text-violet-300 uppercase">{TYPE_LABELS[item.type].one}</p>
              <h2 className="font-semibold">
                {item.title} {item.year && <span className="font-normal text-zinc-400">({item.year})</span>}
              </h2>
              {item.originalTitle && <p className="text-sm text-zinc-500">{item.originalTitle}</p>}
              {details && <p className="text-sm text-zinc-400">{details}</p>}
              {item.overview && <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{item.overview}</p>}
              <div className="mt-auto pt-2">
                {canLog ? (
                  <button
                    type="button"
                    onClick={() => onPick(item)}
                    className="rounded-md bg-violet-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-400"
                  >
                    Log it
                  </button>
                ) : signedIn ? (
                  <Link href="/onboarding" className="text-sm text-violet-400 hover:underline">
                    Pick a username to log things
                  </Link>
                ) : (
                  <Link href="/login" className="text-sm text-violet-400 hover:underline">
                    Log in to log this
                  </Link>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
