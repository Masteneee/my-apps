import { describe, expect, it } from "vitest";
import {
  applyLikeChange,
  attachSocial,
  buildFeed,
  displayName,
  feedAction,
  FEED_LIMIT,
  hasReview,
  likeProblem,
  newestFirst,
  summarizeLikes,
} from "./feed";
import type { LogStatus, LogWithMedia, MediaType, PublicProfile } from "./types";

// A small log: who wrote it, when (minutes after noon UTC), and optional extras.
function log(id: string, userId: string, minute: number, extra: Partial<LogWithMedia> = {}): LogWithMedia {
  return {
    id,
    user_id: userId,
    media_item_id: "item-1",
    status: "completed",
    rating: null,
    progress: null,
    progress_unit: null,
    review_text: null,
    started_at: null,
    finished_at: null,
    rewatch: false,
    created_at: new Date(Date.UTC(2026, 10, 5, 12, minute)).toISOString(),
    media: {
      id: "item-1",
      type: "movie",
      source: "tmdb",
      source_id: "1",
      title: "Interstellar",
      year: 2014,
      cover_url: null,
      creators: [],
      total_units: null,
      genres: [],
      cached_at: "2026-11-05T12:00:00.000Z",
    },
    ...extra,
  };
}

const person = (id: string, display_name: string | null = null): PublicProfile => ({
  id,
  username: id,
  display_name,
  avatar_url: null,
});

describe("newestFirst", () => {
  it("sorts by time, newest first, and breaks ties by id", () => {
    const logs = [log("a", "u", 1), log("b", "u", 5), log("c", "u", 5), log("d", "u", 3)];
    expect(newestFirst(logs).map((l) => l.id)).toEqual(["c", "b", "d", "a"]);
  });

  it("doesn't change the array it was given", () => {
    const logs = [log("a", "u", 1), log("b", "u", 2)];
    newestFirst(logs);
    expect(logs.map((l) => l.id)).toEqual(["a", "b"]);
  });
});

describe("buildFeed (the home feed)", () => {
  const logs = [
    log("ana-old", "ana", 1),
    log("me", "me", 2),
    log("ben", "ben", 3),
    log("stranger", "zoe", 4),
    log("ana-new", "ana", 5),
  ];

  it("keeps only the people you follow, newest first", () => {
    expect(buildFeed(logs, ["ana", "ben"]).map((l) => l.id)).toEqual(["ana-new", "ben", "ana-old"]);
  });

  it("is empty when you follow nobody", () => {
    expect(buildFeed(logs, [])).toEqual([]);
  });

  it("doesn't show your own logs (unless you somehow follow yourself)", () => {
    expect(buildFeed(logs, ["ana"]).some((l) => l.user_id === "me")).toBe(false);
  });

  it("stops at the limit, keeping the newest", () => {
    expect(buildFeed(logs, ["ana", "ben"], 2).map((l) => l.id)).toEqual(["ana-new", "ben"]);
    const many = Array.from({ length: FEED_LIMIT + 10 }, (_, i) => log(`log-${i}`, "ana", i));
    const feed = buildFeed(many, ["ana"]);
    expect(feed).toHaveLength(FEED_LIMIT);
    expect(feed[0].id).toBe(`log-${FEED_LIMIT + 9}`);
  });
});

describe("summarizeLikes", () => {
  it("counts likes per review and remembers if I liked it", () => {
    const likes = [
      { user_id: "ana", log_id: "r1" },
      { user_id: "me", log_id: "r1" },
      { user_id: "ben", log_id: "r2" },
    ];
    const summary = summarizeLikes(likes, "me");
    expect(summary.get("r1")).toEqual({ count: 2, likedByMe: true });
    expect(summary.get("r2")).toEqual({ count: 1, likedByMe: false });
    expect(summary.get("r3")).toBeUndefined();
  });

  it("never says 'liked by me' when signed out", () => {
    expect(summarizeLikes([{ user_id: "ana", log_id: "r1" }], null).get("r1")?.likedByMe).toBe(false);
  });
});

describe("attachSocial", () => {
  it("adds the author and the likes to each log, keeping the order", () => {
    const result = attachSocial(
      [log("r2", "ben", 2), log("r1", "ana", 1)],
      [person("ana", "Ana"), person("ben")],
      [
        { user_id: "ben", log_id: "r1" },
        { user_id: "me", log_id: "r1" },
      ],
      "me",
    );
    expect(result.map((r) => [r.id, r.author.id, r.likeCount, r.likedByMe])).toEqual([
      ["r2", "ben", 0, false],
      ["r1", "ana", 2, true],
    ]);
  });

  it("skips logs whose author is unknown", () => {
    expect(attachSocial([log("r1", "ghost", 1)], [person("ana")], [], null)).toEqual([]);
  });
});

describe("who may like a review", () => {
  const review = { user_id: "ana", review_text: "Loved it" };

  it("lets you like someone else's review", () => {
    expect(likeProblem(review, "me")).toBeNull();
  });

  it("refuses your own review, a log without a review, and signed-out visitors", () => {
    expect(likeProblem(review, "ana")).toContain("your own");
    expect(likeProblem({ user_id: "ana", review_text: null }, "me")).toContain("no review");
    expect(likeProblem({ user_id: "ana", review_text: "   " }, "me")).toContain("no review");
    expect(likeProblem(review, null)).toContain("logged in");
  });

  it("knows what counts as a review", () => {
    expect(hasReview({ review_text: "Yes" })).toBe(true);
    expect(hasReview({ review_text: "" })).toBe(false);
    expect(hasReview({ review_text: null })).toBe(false);
  });
});

describe("feedAction (what the feed line says)", () => {
  const action = (type: MediaType, status: LogStatus, rewatch = false) =>
    feedAction({ ...log("x", "ana", 1), status, rewatch, media: { ...log("x", "ana", 1).media, type } });

  it("uses the right verb for each media type", () => {
    expect(action("movie", "completed")).toBe("watched");
    expect(action("book", "completed")).toBe("read");
    expect(action("game", "completed")).toBe("finished");
    expect(action("manga", "in_progress")).toBe("is reading");
    expect(action("anime", "in_progress")).toBe("is watching");
    expect(action("game", "planned")).toBe("wants to play");
    expect(action("series", "planned")).toBe("wants to watch");
  });

  it("says 're' for a rewatch, and handles dropped and paused", () => {
    expect(action("movie", "completed", true)).toBe("rewatched");
    expect(action("book", "completed", true)).toBe("reread");
    expect(action("anime", "dropped")).toBe("dropped");
    expect(action("game", "paused")).toBe("paused");
  });
});

describe("displayName", () => {
  it("uses the display name, or @username", () => {
    expect(displayName({ username: "ana", display_name: "Ana B." })).toBe("Ana B.");
    expect(displayName({ username: "ana", display_name: null })).toBe("@ana");
  });
});

describe("applyLikeChange", () => {
  it("changes only the liked log, in a new array", () => {
    const logs = attachSocial([log("r1", "ana", 1), log("r2", "ana", 2)], [person("ana")], [], "me");
    const changed = applyLikeChange(logs, "r2", { likeCount: 1, likedByMe: true });
    expect(changed.map((l) => [l.id, l.likeCount, l.likedByMe])).toEqual([
      ["r1", 0, false],
      ["r2", 1, true],
    ]);
    expect(changed).not.toBe(logs);
    expect(logs[1].likeCount).toBe(0);
  });
});
