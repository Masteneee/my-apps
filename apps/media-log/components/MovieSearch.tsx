"use client";
// The /search page: a search box, the results, and the log form.
// The search itself happens on OUR server (/api/movies/search), which talks to
// TMDB, so the TMDB key never reaches the browser.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ratingToStars, MOVIE_STATUS_LABELS } from "@/lib/media/display";
import type { LogWithMedia, MediaResult } from "@/lib/media";
import type { MovieSearchResponse } from "@/lib/tmdb/search";
import { useAuth } from "./AuthProvider";
import { LogMovieForm } from "./LogMovieForm";
import { Poster } from "./Poster";

async function fetchMovies(query: string): Promise<MovieSearchResponse> {
  // encodeURIComponent turns spaces, "&", accents... into URL-safe text.
  const response = await fetch(`/api/movies/search?q=${encodeURIComponent(query)}`);
  return (await response.json()) as MovieSearchResponse;
}

// What the last finished search looked for, and what came back.
type SearchState = { query: string; results: MediaResult[]; error: string | null };

export function MovieSearch() {
  const { status, profile, profileLoading } = useAuth();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState | null>(null);
  const [busy, setBusy] = useState(false);
  // null = we don't know yet (the first answer from the server tells us).
  const [usesSample, setUsesSample] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<MediaResult | null>(null);
  const [saved, setSaved] = useState<LogWithMedia | null>(null);
  // Counts searches, so a slow old answer can't replace a newer one.
  // useRef keeps a value between renders WITHOUT redrawing when it changes.
  const latestRequest = useRef(0);

  // On page load, ask the server with an empty search just to learn whether
  // it uses sample data, so the note shows before the first search.
  useEffect(() => {
    fetchMovies("")
      .then((data) => setUsesSample(data.usesSample))
      .catch(() => {}); // not important: the first real search will tell us
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const wanted = query.trim();
    if (!wanted) return;

    const requestNumber = ++latestRequest.current;
    setBusy(true);
    setSaved(null);
    setSelected(null);
    try {
      const data = await fetchMovies(wanted);
      if (requestNumber !== latestRequest.current) return; // a newer search started, ignore this one
      setUsesSample(data.usesSample);
      setSearch({ query: wanted, results: data.results, error: data.error ?? null });
    } catch {
      if (requestNumber !== latestRequest.current) return;
      setSearch({ query: wanted, results: [], error: "Search failed. Is the app still running?" });
    } finally {
      if (requestNumber === latestRequest.current) setBusy(false);
    }
  }

  function handleSaved(log: LogWithMedia) {
    setSaved(log);
    setSelected(null);
  }

  // Only someone signed in WITH a username can log (logs belong to a profile).
  const canLog = status === "signed-in" && !profileLoading && profile !== null;

  return (
    <div>
      <h1 className="text-3xl font-bold">Search movies</h1>

      {usesSample && (
        <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <strong>Sample data.</strong> No TMDB key is set on the server, so search only knows about a dozen
          well-known movies (try <em>Interstellar</em>, <em>Spirited Away</em> or <em>Parasite</em>). Add a TMDB key
          to search every movie (see README).
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row" role="search">
        <label htmlFor="movie-query" className="sr-only">
          Movie title
        </label>
        <input
          id="movie-query"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a movie, e.g. Interstellar"
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
      </form>

      {/* aria-live: screen readers read out this message when it changes. */}
      <div aria-live="polite">
        {saved && (
          <p className="mt-6 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Logged <strong>{saved.media.title}</strong> as &ldquo;{MOVIE_STATUS_LABELS[saved.status]}&rdquo;
            {saved.rating !== null && ` ${ratingToStars(saved.rating)}`}.{" "}
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
          <LogMovieForm media={selected} onSaved={handleSaved} onCancel={() => setSelected(null)} />
        </div>
      ) : (
        <SearchResults search={search} canLog={canLog} signedIn={status === "signed-in"} onPick={setSelected} />
      )}

      {/* TMDB's terms ask apps that use its data to say so. */}
      <p className="mt-12 text-xs text-zinc-500">
        Movie data and posters come from TMDB. This product uses the TMDB API but is not endorsed or certified by
        TMDB.
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
    return <p className="mt-6 text-zinc-400">No movies found for &ldquo;{search.query}&rdquo;.</p>;
  }

  return (
    <ul className="mt-6 space-y-3">
      {search.results.map((movie) => (
        <li
          key={`${movie.source}-${movie.sourceId}`}
          className="flex gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3"
        >
          <div className="w-16 shrink-0 sm:w-20">
            <Poster src={movie.coverUrl} title={movie.title} />
          </div>
          {/* min-w-0 lets long titles wrap instead of pushing the layout wider than the phone. */}
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="font-semibold">
              {movie.title} {movie.year && <span className="font-normal text-zinc-400">({movie.year})</span>}
            </h2>
            {movie.originalTitle && <p className="text-sm text-zinc-500">{movie.originalTitle}</p>}
            {movie.overview && <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{movie.overview}</p>}
            <div className="mt-auto pt-2">
              {canLog ? (
                <button
                  type="button"
                  onClick={() => onPick(movie)}
                  className="rounded-md bg-violet-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-400"
                >
                  Log it
                </button>
              ) : signedIn ? (
                <Link href="/onboarding" className="text-sm text-violet-400 hover:underline">
                  Pick a username to log movies
                </Link>
              ) : (
                <Link href="/login" className="text-sm text-violet-400 hover:underline">
                  Log in to log this movie
                </Link>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
