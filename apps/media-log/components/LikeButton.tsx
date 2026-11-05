"use client";
// The heart under a review. Shows the like count; clicking likes or unlikes.
// Your own reviews (and visitors who aren't logged in) see the count only.

import { useState } from "react";
import { getMediaStore, type SocialLog } from "@/lib/media";
import { likeProblem } from "@/lib/media/feed";
import { useAuth } from "./AuthProvider";

type Props = {
  log: SocialLog;
  /** Called with the new count and state, so the parent can update its copy. */
  onChange: (change: { likeCount: number; likedByMe: boolean }) => void;
};

export function LikeButton({ log, onChange }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Same rule as the stores (and the database policy): no liking your own review.
  const canLike = likeProblem(log, user?.id ?? null) === null;
  const label = `${log.likeCount} ${log.likeCount === 1 ? "like" : "likes"}`;

  if (!canLike) {
    return (
      <span className="text-sm text-zinc-500" aria-label={label}>
        ♥ {log.likeCount}
      </span>
    );
  }

  async function toggle() {
    setBusy(true);
    setError(null);
    const liked = log.likedByMe;
    // "Optimistic update": show the change right away, and undo it if saving fails.
    onChange({ likeCount: log.likeCount + (liked ? -1 : 1), likedByMe: !liked });
    try {
      const store = getMediaStore();
      if (liked) await store.unlikeReview(log.id);
      else await store.likeReview(log.id);
    } catch (err) {
      onChange({ likeCount: log.likeCount, likedByMe: liked }); // put it back
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={log.likedByMe}
        aria-label={`${log.likedByMe ? "Unlike" : "Like"} this review (${label})`}
        className={`rounded-md px-2 py-1 text-sm hover:bg-zinc-800 disabled:opacity-60 ${
          log.likedByMe ? "text-pink-400" : "text-zinc-400"
        }`}
      >
        {log.likedByMe ? "♥" : "♡"} {log.likeCount}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}
