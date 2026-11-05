"use client";
// The diary page /u/[username]/diary: everything someone logged, as a
// timeline grouped by month (newest first), like Letterboxd's diary.
// The grouping is the pure function groupDiaryByMonth() in lib/media/diary.ts.

import Link from "next/link";
import { groupDiaryByMonth } from "@/lib/media/diary";
import { logProgressLabel, ratingToStars, statusLabel, TYPE_LABELS } from "@/lib/media/display";
import { mediaItemPath } from "@/lib/media/links";
import { useAuth } from "./AuthProvider";
import { Poster } from "./Poster";
import { useProfileLogs } from "./useProfileLogs";

export function DiaryView({ username }: { username: string }) {
  const { user } = useAuth();
  const { wanted, lookup } = useProfileLogs(username);

  if (!lookup) return <p className="text-zinc-400">Loading diary...</p>;
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

  const isMe = user?.id === profile.id;
  const months = groupDiaryByMonth(lookup.logs);

  return (
    <div>
      <p className="text-sm">
        <Link href={`/u/${profile.username}`} className="text-violet-400 hover:underline">
          ← @{profile.username}
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-bold">{isMe ? "My diary" : `${profile.display_name || profile.username}'s diary`}</h1>
      <p className="mt-1 text-zinc-400">
        Everything logged, newest first. A log goes on the day it was finished, or else the day it was logged.
      </p>

      {lookup.logsError && (
        <p role="alert" className="mt-6 text-sm text-red-400">
          {lookup.logsError}
        </p>
      )}

      {months.length === 0 && !lookup.logsError && (
        <p className="mt-10 rounded-lg border border-dashed border-zinc-700 p-10 text-center text-zinc-400">
          Nothing in the diary yet.{" "}
          {isMe && (
            <Link href="/search" className="text-violet-400 hover:underline">
              Log something
            </Link>
          )}
        </p>
      )}

      {months.map((month) => (
        <section key={month.key} className="mt-10">
          {/* sticky: the month name stays at the top while you scroll through it. */}
          <h2 className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950 py-2 text-lg font-semibold">
            {month.label} <span className="text-sm font-normal text-zinc-500">{month.entries.length}</span>
          </h2>
          <ol className="divide-y divide-zinc-800">
            {month.entries.map(({ log, day }) => {
              const progress = logProgressLabel(log);
              return (
                <li key={log.id} className="flex items-center gap-4 py-3">
                  {/* The day of the month, like a calendar page. */}
                  <span className="w-8 shrink-0 text-center text-xl font-bold text-zinc-500">{day}</span>
                  <Link href={mediaItemPath(log.media)} className="w-10 shrink-0 sm:w-12">
                    <Poster src={log.media.cover_url} title={log.media.title} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={mediaItemPath(log.media)} className="font-medium hover:underline">
                      {log.media.title}
                    </Link>
                    {log.media.year && <span className="text-sm text-zinc-500"> {log.media.year}</span>}
                    <p className="text-sm text-zinc-400">
                      <span className="text-violet-300">{TYPE_LABELS[log.media.type].one}</span> ·{" "}
                      {statusLabel(log.status, log.media.type)}
                      {progress && ` · ${progress}`}
                      {log.rewatch && " · again"}
                    </p>
                    {log.review_text && <p className="mt-1 line-clamp-2 text-sm text-zinc-300">{log.review_text}</p>}
                  </div>
                  {log.rating !== null && (
                    <span className="shrink-0 text-amber-300" aria-label={`${log.rating} out of 5 stars`}>
                      {ratingToStars(log.rating)}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
