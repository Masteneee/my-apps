// The poster grid on a profile: one poster per logged movie, with the rating
// (or the status, if not rated) underneath. Pure layout, no state.

import { MOVIE_STATUS_LABELS, ratingToStars } from "@/lib/media/display";
import type { LogWithMedia } from "@/lib/media";
import { Poster } from "./Poster";

export function PosterGrid({ logs }: { logs: LogWithMedia[] }) {
  return (
    // 3 posters per row on phones, 4 on tablets, 6 on wide screens.
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {logs.map((log) => (
        <li key={log.id}>
          <Poster src={log.media.cover_url} title={log.media.title} />
          {/* truncate cuts long titles with "..."; the title attribute shows the full one on hover. */}
          <p className="mt-1.5 truncate text-sm font-medium" title={log.media.title}>
            {log.media.title}
          </p>
          <p className="text-xs text-zinc-400">
            {log.rating !== null ? (
              <span className="text-amber-300" aria-label={`${log.rating} out of 5 stars`}>
                {ratingToStars(log.rating)}
              </span>
            ) : (
              MOVIE_STATUS_LABELS[log.status]
            )}
            {log.media.year && <span className="text-zinc-500"> · {log.media.year}</span>}
          </p>
        </li>
      ))}
    </ul>
  );
}
