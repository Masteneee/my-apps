import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStorage, createMockAuthService } from "../auth/mock";
import type { AuthService } from "../auth/types";
import { addDays } from "../checkin/date";
import { createMockCheckinStore } from "../checkin/mock";
import type { CheckinStore, Habit } from "../checkin/types";
import { DEMO_FRIEND, DEMO_HISTORY_DAYS, DEMO_MISSED_DAYS_AGO } from "./demo-friend";
import { createMockFriendsStore } from "./mock";
import { computeSharedStreak, splitSharedDays } from "./shared-streaks";

const TODAY = "2026-11-05";

let storage: ReturnType<typeof createMemoryStorage>;
let auth: AuthService;
let checkins: CheckinStore;
let friends: ReturnType<typeof createMockFriendsStore>;
const ids: Record<string, string> = {};

// Signs up a demo account with a username; it stays signed in.
async function makeAccount(name: string) {
  await auth.signUp(`${name}@example.com`, "password1");
  const profile = await auth.createProfile({ username: name, displayName: name.toUpperCase() });
  ids[name] = profile.id;
}

async function signInAs(name: string) {
  await auth.signIn(`${name}@example.com`, "password1");
}

async function befriend(a: string, b: string) {
  await signInAs(a);
  const request = await friends.sendFriendRequest(b);
  await signInAs(b);
  await friends.respondToFriendRequest(request.id, true);
}

beforeEach(async () => {
  storage = createMemoryStorage();
  let n = 0;
  auth = createMockAuthService(storage, () => `user-${++n}`);
  const getCurrentUserId = async () => (await auth.getCurrentUser())?.id ?? null;
  let m = 0;
  const makeId = () => `id-${++m}`;
  const now = () => new Date("2026-11-05T15:00:00.000Z");
  checkins = createMockCheckinStore({ storage, getCurrentUserId, makeId, now });
  friends = createMockFriendsStore({ storage, getCurrentUserId, makeId, now, today: () => TODAY });
  await makeAccount("alice");
  await makeAccount("bob");
  await makeAccount("carol");
});

describe("demo friends store: finding people", () => {
  it("finds a public profile by username, in any case, with only the public fields", async () => {
    await signInAs("alice");
    expect(await friends.findProfileByUsername("BOB")).toEqual({ id: ids.bob, username: "bob", display_name: "BOB" });
    expect(await friends.findProfileByUsername("nobody")).toBeNull();
  });

  it("needs you to be logged in (like RLS)", async () => {
    await auth.signOut();
    await expect(friends.findProfileByUsername("bob")).rejects.toThrow("logged in");
  });
});

describe("demo friends store: friend requests", () => {
  it("sends a request that the other person sees as incoming, then accepts it", async () => {
    await signInAs("alice");
    const sent = await friends.sendFriendRequest("@Bob");
    expect(sent).toMatchObject({ status: "pending", direction: "outgoing", friend: { username: "bob" } });

    await signInAs("bob");
    const [incoming] = await friends.listFriendships();
    expect(incoming).toMatchObject({ status: "pending", direction: "incoming", friend: { username: "alice" } });
    await friends.respondToFriendRequest(incoming.id, true);

    await signInAs("alice");
    expect((await friends.listFriendships())[0].status).toBe("accepted");
  });

  it("refuses unknown names, yourself, and asking twice", async () => {
    await signInAs("alice");
    await expect(friends.sendFriendRequest("nobody")).rejects.toThrow("Nobody has that username");
    await expect(friends.sendFriendRequest("alice")).rejects.toThrow("That's you");
    await friends.sendFriendRequest("bob");
    await expect(friends.sendFriendRequest("bob")).rejects.toThrow("already asked");
  });

  it("asking someone who already asked you makes you friends", async () => {
    await signInAs("alice");
    await friends.sendFriendRequest("bob");
    await signInAs("bob");
    const result = await friends.sendFriendRequest("alice");
    expect(result.status).toBe("accepted");
    expect(await friends.listFriendships()).toHaveLength(1); // still one row for the pair
  });

  it("only the person asked can accept; declining deletes the request", async () => {
    await signInAs("alice");
    const sent = await friends.sendFriendRequest("bob");
    await expect(friends.respondToFriendRequest(sent.id, true)).rejects.toThrow();

    await signInAs("bob");
    await friends.respondToFriendRequest(sent.id, false);
    expect(await friends.listFriendships()).toEqual([]);
    await signInAs("alice");
    expect(await friends.listFriendships()).toEqual([]); // alice can ask again later
  });

  it("other people can't see your friendships", async () => {
    await befriend("alice", "bob");
    await signInAs("carol");
    expect(await friends.listFriendships()).toEqual([]);
  });
});

describe("demo friends store: shared streaks", () => {
  let aliceStretch: Habit;
  let bobStretch: Habit;

  beforeEach(async () => {
    await befriend("alice", "bob");
    await signInAs("bob");
    bobStretch = await checkins.createHabit({ name: "Stretch", type: "checkbox" });
    await signInAs("alice");
    aliceStretch = await checkins.createHabit({ name: "Stretch", type: "checkbox" });
  });

  async function startSharing() {
    await signInAs("alice");
    const invite = await friends.createSharedStreak(ids.bob, aliceStretch);
    await signInAs("bob");
    await friends.acceptSharedStreak(invite.id, bobStretch.id);
    return invite;
  }

  it("invites a friend on your habit; they accept with THEIR habit", async () => {
    const invite = await friends.createSharedStreak(ids.bob, aliceStretch);
    expect(invite).toMatchObject({ status: "pending", direction: "outgoing", habit_name: "Stretch", myHabitId: aliceStretch.id });

    await signInAs("bob");
    const [incoming] = await friends.listSharedStreaks();
    expect(incoming).toMatchObject({ status: "pending", direction: "incoming", myHabitId: null });
    await friends.acceptSharedStreak(incoming.id, bobStretch.id);
    expect((await friends.listSharedStreaks())[0]).toMatchObject({ status: "active", myHabitId: bobStretch.id });
  });

  it("refuses strangers, other people's habits, archived habits and duplicates", async () => {
    await expect(friends.createSharedStreak(ids.carol, aliceStretch)).rejects.toThrow("with a friend");
    await expect(friends.createSharedStreak(ids.bob, bobStretch)).rejects.toThrow("your active habits");
    const old = await checkins.createHabit({ name: "Old", type: "checkbox" });
    await checkins.setHabitArchived(old.id, true);
    await expect(friends.createSharedStreak(ids.bob, old)).rejects.toThrow("your active habits");

    const invite = await friends.createSharedStreak(ids.bob, aliceStretch);
    await expect(friends.createSharedStreak(ids.bob, aliceStretch)).rejects.toThrow("already share");
    // Only bob can accept, and only with his own habit.
    await expect(friends.acceptSharedStreak(invite.id, aliceStretch.id)).rejects.toThrow();
    await signInAs("bob");
    await expect(friends.acceptSharedStreak(invite.id, aliceStretch.id)).rejects.toThrow("your active habits");
  });

  it("gives each person only (who, which day) for the shared habit, using each owner's goal", async () => {
    const invite = await startSharing();
    await checkins.saveHabitEntry(bobStretch, "2026-11-04", 1);
    await checkins.saveHabitEntry(bobStretch, TODAY, 1);
    // A habit that isn't shared must never show up.
    const bobWater = await checkins.createHabit({ name: "Water", type: "number", target: 8 });
    await checkins.saveHabitEntry(bobWater, "2026-11-04", 9);
    await checkins.saveCheckin(TODAY, { journal_text: "private thoughts", mood: 2 });

    await signInAs("alice");
    await checkins.saveHabitEntry(aliceStretch, "2026-11-04", 1);
    const days = await friends.listSharedStreakDays(invite.id, "2026-11-01", TODAY);
    expect(days).toEqual([
      { user_id: ids.alice, date: "2026-11-04" },
      { user_id: ids.bob, date: "2026-11-04" },
      { user_id: ids.bob, date: TODAY },
    ]);
    // Nothing else in there: no values, no journal, no mood.
    expect(JSON.stringify(days)).not.toMatch(/journal|private|mood|value/);

    // Bob did it today and Alice hasn't: the nudge.
    const { mine, theirs } = splitSharedDays(days, ids.alice);
    const result = computeSharedStreak(mine, theirs, TODAY);
    expect(result.nudge).toBe(true);
    expect(result.streak.current).toBe(1);
  });

  it("a count habit only counts on days its owner reached their goal", async () => {
    await signInAs("bob");
    const bobPages = await checkins.createHabit({ name: "Pages", type: "number", target: 10 });
    await signInAs("alice");
    const alicePages = await checkins.createHabit({ name: "Pages", type: "number" }); // no goal
    const invite = await friends.createSharedStreak(ids.bob, alicePages);
    await signInAs("bob");
    await friends.acceptSharedStreak(invite.id, bobPages.id);
    await checkins.saveHabitEntry(bobPages, "2026-11-03", 5); // not his goal
    await checkins.saveHabitEntry(bobPages, "2026-11-04", 12);
    const days = await friends.listSharedStreakDays(invite.id, "2026-11-01", TODAY);
    expect(days).toEqual([{ user_id: ids.bob, date: "2026-11-04" }]);
  });

  it("shows nothing for pending invites or to people outside the streak", async () => {
    const invite = await friends.createSharedStreak(ids.bob, aliceStretch);
    await checkins.saveHabitEntry(aliceStretch, TODAY, 1);
    expect(await friends.listSharedStreakDays(invite.id, "2026-11-01", TODAY)).toEqual([]); // pending

    await signInAs("bob");
    await friends.acceptSharedStreak(invite.id, bobStretch.id);
    await signInAs("carol");
    expect(await friends.listSharedStreakDays(invite.id, "2026-11-01", TODAY)).toEqual([]);
    expect(await friends.listSharedStreaks()).toEqual([]);
  });

  it("unfriending ends the shared streaks too (like on delete cascade)", async () => {
    await startSharing();
    const [friendship] = await friends.listFriendships();
    await friends.removeFriendship(friendship.id);
    expect(await friends.listSharedStreaks()).toEqual([]);
    await signInAs("alice");
    expect(await friends.listSharedStreaks()).toEqual([]);
  });

  it("either person can stop a shared streak", async () => {
    const invite = await startSharing();
    await friends.removeSharedStreak(invite.id);
    await signInAs("alice");
    expect(await friends.listSharedStreaks()).toEqual([]);
    await expect(friends.removeSharedStreak(invite.id)).rejects.toThrow("doesn't exist");
  });
});

describe("demo friend Sam (demo mode only)", () => {
  it("is added as a friend straight away, and can log in like any demo account", async () => {
    await signInAs("alice");
    await friends.addDemoFriend();
    await friends.addDemoFriend(); // twice is fine
    const list = await friends.listFriendships();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ status: "accepted", friend: { username: DEMO_FRIEND.username } });

    await auth.signIn(DEMO_FRIEND.email, DEMO_FRIEND.password);
    expect((await friends.listFriendships())[0].friend.username).toBe("alice");
  });

  it("accepts a friend request by username at once", async () => {
    await signInAs("alice");
    await friends.addDemoFriend(); // creates Sam's account
    await friends.removeFriendship((await friends.listFriendships())[0].id);
    expect((await friends.sendFriendRequest(DEMO_FRIEND.username)).status).toBe("accepted");
  });

  it("accepts a shared streak at once, with a made-up history that includes today", async () => {
    await signInAs("alice");
    await friends.addDemoFriend();
    const stretch = await checkins.createHabit({ name: "Stretch", type: "checkbox" });
    const streak = await friends.createSharedStreak(DEMO_FRIEND.id, stretch);
    expect(streak.status).toBe("active");

    const days = await friends.listSharedStreakDays(streak.id, addDays(TODAY, -30), TODAY);
    const { mine, theirs } = splitSharedDays(days, ids.alice);
    expect(mine).toEqual([]);
    expect(theirs).toHaveLength(DEMO_HISTORY_DAYS - DEMO_MISSED_DAYS_AGO.length);
    expect(theirs).toContain(TODAY);
    expect(theirs).not.toContain(addDays(TODAY, -3));
    expect(computeSharedStreak(mine, theirs, TODAY).nudge).toBe(true); // "Sam checked in, your turn"
  });

  it("'Sam checks in today' marks Sam's shared habits done today, once", async () => {
    await signInAs("alice");
    await friends.addDemoFriend();
    const stretch = await checkins.createHabit({ name: "Stretch", type: "checkbox" });
    const streak = await friends.createSharedStreak(DEMO_FRIEND.id, stretch);
    // Pretend a day passed: remove Sam's entry for today, then check in again.
    const db = JSON.parse(storage.getItem("wellbeing-app:mock-checkins")!);
    db.habitEntries = db.habitEntries.filter((e: { date: string }) => e.date !== TODAY);
    storage.setItem("wellbeing-app:mock-checkins", JSON.stringify(db));

    await friends.demoFriendChecksInToday();
    await friends.demoFriendChecksInToday();
    const days = await friends.listSharedStreakDays(streak.id, TODAY, TODAY);
    expect(days).toEqual([{ user_id: DEMO_FRIEND.id, date: TODAY }]);
  });
});
