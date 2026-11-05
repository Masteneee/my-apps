"use client";
// The stats page /u/[username]/stats (Stage 6): how many of each media type,
// how someone rates, their top genres, and a recap of one year.
// Every number comes from the pure functions in lib/media/stats.ts; this file
// only draws them. The bars are plain HTML: a box whose width is a percentage.

import Link from "next/link";
import { useState } from "react";
import { countByType, ratingToStars, TYPE_LABELS } from "@/lib/media/display";
import { mediaItemPath } from "@/lib/media/links";
import { fillLogGenres } from "@/lib/media/recommend";
import { barPercent, maxCount, ratingDistribution, recapYears, topTags, yearlyRecap } from "@/lib/media/stats";
import { TAG_LABELS } from "@/lib/media/tags";
import { MEDIA_TYPES } from "@/lib/media/types";
import { sampleCatalog } from "@/lib/sources/catalog";
import { Poster } from "./Poster";
import { useProfileLogs } from "./useProfileLogs";

/** One horizontal bar: a label, a bar, a number. */
function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  return (
    <li className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-3 text-sm">
      <span className="truncate text-zinc-300">{label}</span>
      {/* The grey track is the full width; the violet part is count / max of it. */}
      <span className="h-3 overflow-hidden rounded-full bg-zinc-800" aria-hidden="true">
        <span className="block h-full rounded-full bg-violet-500" style={{ width: `${barPercent(count, max)}%` }} />
      </span>
      <span className="text-right tabular-nums text-zinc-400">{count}</span>
    </li>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function StatsView({ username }: { username: string }) {
  const { wanted, lookup } = useProfileLogs(username);
  // Which year the recap shows. null = "the newest year with entries".
  const [pickedYear, setPickedYear] = useState<number | null>(null);

  if (!lookup) return <p className="text-zinc-400">Loading stats...</p>;
  if (lookup.error) return <p className="text-red-400">{lookup.error}</p>;

  const profile = lookup.profile;
  if (!profile) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-bold">No one here yet</h1>
        <p className="mt-2 text-zinc-400">There is no user called @{wanted}.</p>
      </div>
    );
  }

  // Items logged before Stage 6 have no genres yet: borrow them from the samples when possible.
  const logs = fillLogGenres(lookup.logs, sampleCatalog());
  const counts = countByType(logs);
  const typeRows = MEDIA_TYPES.map((type) => ({ type, count: counts[type] }));
  const ratings = ratingDistribution(logs);
  const tags = topTags(logs);
  const years = recapYears(logs);
  const year = pickedYear !== null && years.includes(pickedYear) ? pickedYear : (years[0] ?? null);
  const recap = year !== null ? yearlyRecap(logs, year) : null;
  const name = profile.display_name || profile.username;

  return (
    <div>
      <p className="text-sm">
        <Link href={`/u/${profile.username}`} className="text-violet-400 hover:underline">
          ← @{profile.username}
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-bold">{name}&apos;s stats</h1>

      {lookup.logsError && (
        <p role="alert" className="mt-6 text-sm text-red-400">
          {lookup.logsError}
        </p>
      )}

      {logs.length === 0 && !lookup.logsError ? (
        <p className="mt-10 rounded-lg border border-dashed border-zinc-700 p-10 text-center text-zinc-400">
          Nothing logged yet, so no stats.
        </p>
      ) : (
        // One column on phones, two from the "md" breakpoint (768px) up.
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card title="By media type">
            <ul className="space-y-2">
              {typeRows.map((row) => (
                <Bar key={row.type} label={TYPE_LABELS[row.type].many} count={row.count} max={maxCount(typeRows)} />
              ))}
            </ul>
            <p className="mt-3 text-xs text-zinc-500">Each item counts once, even if logged again.</p>
          </Card>

          <Card title="Ratings">
            {ratings.rated === 0 ? (
              <p className="text-sm text-zinc-400">No ratings yet.</p>
            ) : (
              <>
                {/* Vertical bars, 0.5★ to 5★, like Letterboxd's rating histogram. */}
                <div
                  className="flex h-28 items-end gap-1"
                  role="img"
                  aria-label={`Rating distribution of ${ratings.rated} rated items`}
                >
                  {ratings.buckets.map((bucket) => (
                    <div
                      key={bucket.rating}
                      className="flex h-full flex-1 flex-col justify-end"
                      title={`${bucket.rating}★: ${bucket.count}`}
                    >
                      <div
                        className="rounded-t bg-amber-400"
                        style={{ height: `${barPercent(bucket.count, maxCount(ratings.buckets))}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-xs text-zinc-500">
                  <span>½★</span>
                  <span>5★</span>
                </div>
                <p className="mt-3 text-sm text-zinc-400">
                  {ratings.rated} rated · average{" "}
                  <strong className="text-zinc-100">{ratings.average!.toFixed(1)}★</strong>
                </p>
              </>
            )}
          </Card>

          <Card title="Top genres">
            {tags.length === 0 ? (
              <p className="text-sm text-zinc-400">No genres known yet for these items.</p>
            ) : (
              <ul className="space-y-2">
                {tags.map((row) => (
                  <Bar key={row.tag} label={TAG_LABELS[row.tag]} count={row.count} max={maxCount(tags)} />
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-zinc-500">
              Shared tags across movies, anime, books and games. &quot;Want to&quot; items don&apos;t count.
            </p>
          </Card>

          {recap && (
            <Card title={`${recap.year} recap`}>
              {years.length > 1 && (
                <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Pick a year">
                  {years.map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => setPickedYear(y)}
                      aria-pressed={y === recap.year}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        y === recap.year
                          ? "border-violet-400 bg-violet-500/20 text-violet-200"
                          : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              )}
              <dl className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <dt className="text-xs text-zinc-400">Diary entries</dt>
                  <dd className="text-2xl font-bold">{recap.entries}</dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-400">Finished</dt>
                  <dd className="text-2xl font-bold">{recap.finished}</dd>
                </div>
                <div>
                  <dt className="text-xs text-zinc-400">Average</dt>
                  <dd className="text-2xl font-bold">
                    {recap.averageRating !== null ? `${recap.averageRating.toFixed(1)}★` : "–"}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-sm text-zinc-300">
                {MEDIA_TYPES.filter((type) => recap.finishedByType[type] > 0)
                  .map(
                    (type) =>
                      `${recap.finishedByType[type]} ${recap.finishedByType[type] === 1 ? TYPE_LABELS[type].one.toLowerCase() : TYPE_LABELS[type].many.toLowerCase()}`,
                  )
                  .join(" · ") || "Nothing finished yet this year."}
              </p>
              {(recap.topTag || recap.busiestMonth) && (
                <p className="mt-2 text-sm text-zinc-400">
                  {recap.topTag && (
                    <>
                      Top genre: <strong className="text-zinc-100">{TAG_LABELS[recap.topTag.tag]}</strong>.{" "}
                    </>
                  )}
                  {recap.busiestMonth && (
                    <>
                      Busiest month: <strong className="text-zinc-100">{recap.busiestMonth.label}</strong> (
                      {recap.busiestMonth.count}).
                    </>
                  )}
                </p>
              )}
              {recap.topRated.length > 0 && (
                <>
                  <h3 className="mt-4 text-sm font-semibold text-zinc-300">Best rated</h3>
                  <ol className="mt-2 grid grid-cols-3 gap-3">
                    {recap.topRated.map((log) => (
                      <li key={log.id}>
                        <Link href={mediaItemPath(log.media)} className="block">
                          <Poster src={log.media.cover_url} title={log.media.title} sizes="(min-width: 640px) 200px, 33vw" />
                          <span className="mt-1 block truncate text-xs text-zinc-300">{log.media.title}</span>
                          <span className="text-xs text-amber-300">{ratingToStars(log.rating)}</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
