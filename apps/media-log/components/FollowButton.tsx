"use client";
// "Follow" / "Following" button. The parent knows whether you already follow
// this person and is told when it changes, so it can update its counters.

import { useState } from "react";
import { getMediaStore } from "@/lib/media";

type Props = {
  userId: string;
  following: boolean;
  onChange: (nowFollowing: boolean) => void;
};

export function FollowButton({ userId, following, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const store = getMediaStore();
      if (following) await store.unfollow(userId);
      else await store.follow(userId);
      onChange(!following);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      // "finally" runs whether it worked or not, so the button never stays stuck on busy.
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        // aria-pressed tells screen readers this is an on/off button, and whether it's on.
        aria-pressed={following}
        className={
          following
            ? "rounded-md border border-zinc-700 px-4 py-1.5 text-sm font-medium text-zinc-200 hover:border-red-400 hover:text-red-300 disabled:opacity-60"
            : "rounded-md bg-violet-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-60"
        }
      >
        {following ? "Following" : "Follow"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}
