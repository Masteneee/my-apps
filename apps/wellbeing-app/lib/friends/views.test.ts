import { describe, expect, it } from "vitest";
import type { Friendship, PublicProfile, SharedStreak } from "./types";
import { checkFriendRequest, cleanFriendUsername, findPair, toFriendshipView, toSharedStreakView } from "./views";

const bob: PublicProfile = { id: "bob", username: "bob", display_name: "Bob" };
const people = new Map([["bob", bob]]);
const row = (user_a: string, user_b: string, status: Friendship["status"] = "pending"): Friendship => ({
  id: "f1",
  user_a,
  user_b,
  status,
  created_at: "t",
});

describe("cleanFriendUsername", () => {
  it("accepts a username in any case, with or without @", () => {
    expect(cleanFriendUsername("  @Bob_99 ")).toEqual({ ok: true, value: "bob_99" });
  });

  it("explains empty or impossible usernames", () => {
    expect(cleanFriendUsername("  ")).toEqual({ ok: false, error: "Type your friend's username." });
    expect(cleanFriendUsername("no spaces")).toMatchObject({ ok: false });
    expect(cleanFriendUsername("admin")).toMatchObject({ ok: false }); // reserved: nobody can have it
  });
});

describe("checkFriendRequest", () => {
  it("asks when nothing exists yet", () => {
    expect(checkFriendRequest("me", bob, undefined)).toEqual({ action: "insert" });
  });

  it("refuses unknown people and yourself", () => {
    expect(checkFriendRequest("me", null, undefined)).toMatchObject({ action: "error" });
    expect(checkFriendRequest("bob", bob, undefined)).toMatchObject({ action: "error", error: expect.stringContaining("you") });
  });

  it("refuses a second request, or asking a friend again", () => {
    expect(checkFriendRequest("me", bob, row("me", "bob"))).toMatchObject({ error: expect.stringContaining("already asked") });
    expect(checkFriendRequest("me", bob, row("bob", "me", "accepted"))).toMatchObject({
      error: expect.stringContaining("already friends"),
    });
  });

  it("accepts instead, when they had already asked me", () => {
    expect(checkFriendRequest("me", bob, row("bob", "me"))).toEqual({ action: "accept", friendshipId: "f1" });
  });
});

describe("views", () => {
  it("finds a pair in either direction", () => {
    expect(findPair([row("bob", "me")], "me", "bob")).toBeDefined();
    expect(findPair([row("me", "bob")], "me", "bob")).toBeDefined();
    expect(findPair([row("me", "carol")], "me", "bob")).toBeUndefined();
  });

  it("shows a friendship from my side: who the friend is and who asked", () => {
    expect(toFriendshipView(row("me", "bob"), "me", people)).toMatchObject({ direction: "outgoing", friend: bob });
    expect(toFriendshipView(row("bob", "me"), "me", people)).toMatchObject({ direction: "incoming", friend: bob });
    // A profile that couldn't load doesn't crash the page.
    expect(toFriendshipView(row("me", "ghost"), "me", people).friend.username).toBe("unknown");
  });

  it("gives me only MY habit id in a shared streak", () => {
    const streak: SharedStreak = {
      id: "s1",
      friendship_id: "f1",
      habit_name: "Stretch",
      user_a: "bob",
      user_b: "me",
      habit_a: "bobs-habit",
      habit_b: "my-habit",
      status: "active",
      created_at: "t",
    };
    const view = toSharedStreakView(streak, "me", people);
    expect(view).toMatchObject({ direction: "incoming", myHabitId: "my-habit", friend: bob });
    expect(JSON.stringify(view)).not.toContain("bobs-habit");
    expect(toSharedStreakView(streak, "bob", new Map()).myHabitId).toBe("bobs-habit");
  });
});
