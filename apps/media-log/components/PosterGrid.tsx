// The poster grid on a profile: one poster per logged item, with the rating
// (or the status, if not rated) underneath, and the progress while you're in
// the middle of it. Each poster opens the item page. Pure layout, no state.

import Link from "next/link";
import { logProgressLabel, ratingToStars, statusLabel } from "@/lib/media/display";
import { mediaItemPath } from "@/lib/media/links";
import type { LogWithMedia } from "@/lib/media";
import { Poster } from "./Poster";

export function PosterGrid({ logs }: { logs: LogWithMedia[] }) {
  return (
    // 3 posters per row on phones, 4 on tablets, 6 on wide screens.
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {logs.map((log) => (
        <li key={log.id}>
          <Link href={mediaItemPath(log.media)} className="group block">
            <Poster src={log.media.cover_url} title={log.media.title} />
            {/* truncate cuts long titles with "..."; the title attribute shows the full one on hover. */}
            <p className="mt-1.5 truncate text-sm font-medium group-hover:underline" title={log.media.title}>
              {log.media.title}
            </p>
          </Link>
          <p className="text-xs text-zinc-400">
            {log.rating !== null ? (
              <span className="text-amber-300" aria-label={`${log.rating} out of 5 stars`}>
                {ratingToStars(log.rating)}
              </span>
            ) : (
              statusLabel(log.status, log.media.type)
            )}
            {log.media.year && <span className="text-zinc-500"> · {log.media.year}</span>}
          </p>
          {/* Only while in the middle of it: "Episode 7/24", "45%"... */}
          {log.status !== "completed" && logProgressLabel(log) && (
            <p className="truncate text-xs text-violet-300">{logProgressLabel(log)}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
