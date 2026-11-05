"use client";
// Stage 6, on the home page (signed in only):
// - "Bridge picks": anime, manga and games for people who mostly log movies,
//   series and books (the rule is bridgeAudience() in lib/media/recommend.ts).
// - "More for you": other cross-media picks from everything you rated 4★+.
// Every pick says WHY it was picked. All the choosing happens in the pure
// functions of lib/media/recommend.ts; this file loads data and draws cards.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getMediaStore, type LogWithMedia, type MediaResult } from "@/lib/media";
import type { MediaItem } from "@/lib/media/types";
import { TYPE_LABELS } from "@/lib/media/display";
import { mediaItemPath } from "@/lib/media/links";
import {
  BRIDGE_MIN_ITEMS,
  bridgeAudience,
  bridgePicks,
  buildCandidatePool,
  fillLogGenres,
  mediaResultKey,
  reasonText,
  recommend,
  spreadByType,
  type BridgeAudience,
  type Recommendation,
} from "@/lib/media/recommend";
import { sampleCatalog } from "@/lib/sources/catalog";
import { useAuth } from "./AuthProvider";
import { LogMediaForm } from "./LogMediaForm";
import { Poster } from "./Poster";

const MORE_LIMIT = 6;

type Picks = {
  userId: string;
  audience: BridgeAudience;
  bridge: Recommendation[];
  more: Recommendation[];
};

/** Everything the two sections need, from your logs + the pool (database items and samples). */
function computePicks(userId: string, rawLogs: LogWithMedia[], dbItems: MediaItem[]): Picks {
  const catalog = sampleCatalog();
  const logs = fillLogGenres(rawLogs, catalog);
  const pool = buildCandidatePool(dbItems, catalog);
  const bridge = bridgePicks(logs, pool);
  // Don't show the same item twice: "More for you" skips the bridge picks.
  const shown = new Set(bridge.map((rec) => mediaResultKey(rec.candidate.media)));
  const rest = recommend(logs, pool, { limit: Infinity }).filter(
    (rec) => !shown.has(mediaResultKey(rec.candidate.media)),
  );
  // Spread over the types too, so six series can't fill the whole section.
  const more = spreadByType(rest, MORE_LIMIT);
  return { userId, audience: bridgeAudience(logs), bridge, more };
}

function PickCard({ rec, onLog }: { rec: Recommendation; onLog: (media: MediaResult) => void }) {
  const { media, mediaItemId } = rec.candidate;
  // Items someone already logged have an item page; sample-only items don't yet.
  const href = mediaItemId
    ? mediaItemPath({ type: media.type, source: media.source, source_id: media.sourceId })
    : null;
  const poster = <Poster src={media.coverUrl} title={media.title} sizes="64px" />;
  return (
    <li className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-left">
      <div className="w-16 shrink-0">{href ? <Link href={href}>{poster}</Link> : poster}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-300">{TYPE_LABELS[media.type].one}</p>
        <p className="font-medium">
          {href ? (
            <Link href={href} className="hover:underline">
              {media.title}
            </Link>
          ) : (
            media.title
          )}
          {media.year && <span className="text-sm font-normal text-zinc-500"> {media.year}</span>}
        </p>
        {/* The whole point: say why. */}
        <p className="mt-1 text-sm text-zinc-400">{reasonText(rec)}</p>
        <button
          type="button"
          onClick={() => onLog(media)}
          className="mt-2 rounded-md border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800"
        >
          Log it
        </button>
      </div>
    </li>
  );
}

export function HomePicks() {
  const { user, profile } = useAuth();
  const [picks, setPicks] = useState<Picks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<MediaResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const userId = profile ? (user?.id ?? null) : null; // picks need a profile (logs point to it)

  const load = useCallback(() => {
    if (!userId) return;
    let cancelled = false;
    const store = getMediaStore();
    // Two requests at the same time: your logs, and the cached items (the pool).
    Promise.all([store.getLogsForUser(userId), store.listMediaItems()])
      .then(([logs, items]) => {
        if (!cancelled) {
          setPicks(computePicks(userId, logs, items));
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load your picks.");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => load(), [load]);

  if (!userId) return null; // visitors see the landing page only
  if (error) {
    return (
      <p role="alert" className="text-sm text-red-400">
        {error}
      </p>
    );
  }
  // An answer for another user (after switching accounts) counts as loading.
  if (!picks || picks.userId !== userId) return <p className="text-zinc-400">Loading your picks...</p>;

  if (selected) {
    return (
      <section className="mx-auto max-w-2xl">
        <LogMediaForm
          media={selected}
          cancelLabel="Back to picks"
          onCancel={() => setSelected(null)}
          onSaved={(log) => {
            setSelected(null);
            setMessage(`Logged ${log.media.title}.`);
            load(); // it's logged now, so it leaves the picks
          }}
        />
      </section>
    );
  }

  const { audience, bridge, more } = picks;
  return (
    <div className="mb-10 space-y-10">
      {message && (
        <p role="status" className="rounded-md bg-emerald-500/15 px-4 py-2 text-sm text-emerald-300">
          {message}
        </p>
      )}

      <section aria-labelledby="bridge-picks">
        <h2 id="bridge-picks" className="text-2xl font-bold">
          Bridge picks
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Anime, manga and games for people who mostly watch movies and series and read books, picked from what you
          rated 4★ or more.
        </p>
        {audience.status === "too-few" && (
          <p className="mt-4 rounded-lg border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">
            Log at least {BRIDGE_MIN_ITEMS} things (you have {audience.items}) and rate your favorites 4★ or more.{" "}
            <Link href="/search" className="text-violet-400 hover:underline">
              Search
            </Link>
          </p>
        )}
        {audience.status === "already-niche" && (
          <p className="mt-4 rounded-lg border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">
            You already log plenty of anime, manga or games ({audience.items - audience.mainstreamItems} of{" "}
            {audience.items}), so no bridge needed. Your other picks are below.
          </p>
        )}
        {audience.status === "ok" && bridge.length === 0 && (
          <p className="mt-4 rounded-lg border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">
            Rate a movie, series or book 4★ or more to get bridge picks.
          </p>
        )}
        {bridge.length > 0 && (
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            {bridge.map((rec) => (
              <PickCard key={mediaResultKey(rec.candidate.media)} rec={rec} onLog={setSelected} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="more-picks">
        <h2 id="more-picks" className="text-2xl font-bold">
          More for you
        </h2>
        <p className="mt-1 text-sm text-zinc-400">Other media types that share genres with your favorites.</p>
        {more.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-zinc-700 p-6 text-sm text-zinc-400">
            Nothing yet: rate a few things 4★ or more.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {more.map((rec) => (
              <PickCard key={mediaResultKey(rec.candidate.media)} rec={rec} onLog={setSelected} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
