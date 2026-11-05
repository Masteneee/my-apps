// One log as the feed and the reviews section show it:
// "<avatar> Ana watched Interstellar ★★★★½ · Nov 5", the review, and the like button.
// `showMedia` adds the poster and the item's title (the feed); the item page
// already shows the item, so its reviews leave them out.

import Link from "next/link";
import { diaryDate, formatShortDate } from "@/lib/media/diary";
import { logProgressLabel, ratingToStars, TYPE_LABELS } from "@/lib/media/display";
import { displayName, feedAction } from "@/lib/media/feed";
import { mediaItemPath } from "@/lib/media/links";
import type { SocialLog } from "@/lib/media";
import { Avatar } from "./Avatar";
import { LikeButton } from "./LikeButton";
import { Poster } from "./Poster";

type Props = {
  log: SocialLog;
  showMedia?: boolean;
  onLikeChange: (change: { likeCount: number; likedByMe: boolean }) => void;
};

export function SocialLogCard({ log, showMedia = true, onLikeChange }: Props) {
  const name = displayName(log.author);
  const progress = log.status === "in_progress" ? logProgressLabel(log) : null;

  return (
    <article className="flex gap-3 py-4 sm:gap-4">
      <Link href={`/u/${log.author.username}`} aria-label={`${name}'s profile`}>
        <Avatar name={name} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-zinc-300">
          <Link href={`/u/${log.author.username}`} className="font-semibold text-zinc-100 hover:underline">
            {name}
          </Link>{" "}
          {feedAction(log)}{" "}
          {showMedia && (
            <Link href={mediaItemPath(log.media)} className="font-semibold text-zinc-100 hover:underline">
              {log.media.title}
            </Link>
          )}
          {log.rating !== null && (
            <span className="text-amber-300" aria-label={`${log.rating} out of 5 stars`}>
              {" "}
              {ratingToStars(log.rating)}
            </span>
          )}
        </p>
        <p className="text-xs text-zinc-500">
          {showMedia && <span className="text-violet-300">{TYPE_LABELS[log.media.type].one} · </span>}
          {progress && `${progress} · `}
          {formatShortDate(diaryDate(log))}
        </p>
        {log.review_text && <p className="mt-2 whitespace-pre-line text-zinc-200">{log.review_text}</p>}
        {log.review_text && (
          <div className="mt-1">
            <LikeButton log={log} onChange={onLikeChange} />
          </div>
        )}
      </div>
      {showMedia && (
        <Link href={mediaItemPath(log.media)} className="w-12 shrink-0 sm:w-14">
          <Poster src={log.media.cover_url} title={log.media.title} sizes="56px" />
        </Link>
      )}
    </article>
  );
}
