// The DEMO friends store: friendships and shared streaks in the browser's
// localStorage. Same `FriendsStore` contract as the real one (./supabase.ts).
//
// It mirrors the database rules on purpose (see the Stage 4 migration), so
// demo mode behaves like the real thing:
// - you only see friendships and shared streaks you're part of (like RLS)
// - only the person who was asked can accept; one friendship per pair
// - a shared streak needs an accepted friendship and YOUR OWN active habit
// - removing a friendship also removes its shared streaks ("on delete cascade")
// - listSharedStreakDays copies the security-definer function: it returns
//   only (who, which day) for the two habits in an ACTIVE shared streak,
//   never the value, never anything from the check-in.
//
// It READS the other demo databases (accounts in wellbeing-app:mock-db,
// habits in wellbeing-app:mock-checkins) and saves its own under its own key.

import { normalizeUsername } from "../auth/validation";
import { MOCK_STORAGE_KEY, type KeyValueStorage, type MockDatabase } from "../auth/mock";
import { todayKey } from "../checkin/date";
import { MOCK_CHECKIN_STORAGE_KEY, type MockCheckinDatabase } from "../checkin/mock";
import { validateDateRange } from "../checkin/validation";
import { isHabitDone } from "../streaks";
import { DEMO_FRIEND, demoFriendChecksIn, demoFriendHabitFor, ensureDemoFriendAccount, isDemoFriend } from "./demo-friend";
import type { Friendship, FriendsStore, PublicProfile, SharedDay, SharedStreak } from "./types";
import {
  byCreatedAt,
  checkFriendRequest,
  cleanFriendUsername,
  findPair,
  toFriendshipView,
  toSharedStreakView,
} from "./views";

export const MOCK_FRIENDS_STORAGE_KEY = "wellbeing-app:mock-friends";

export type MockFriendsDatabase = {
  friendships: Friendship[];
  sharedStreaks: SharedStreak[];
};

export type MockFriendsStoreOptions = {
  storage: KeyValueStorage;
  /** Who is signed in (the demo auth knows). null = signed out. */
  getCurrentUserId: () => Promise<string | null>;
  makeId?: () => string;
  now?: () => Date;
  /** Today's date key. Only used for the demo friend's made-up history. */
  today?: () => string;
};

/** Extra buttons that only exist in demo mode (see ./demo-friend.ts). */
export type DemoFriendTools = {
  /** Creates Sam (if needed) and makes you friends right away. */
  addDemoFriend(): Promise<void>;
  /** Sam completes every habit Sam shares with you, today. */
  demoFriendChecksInToday(): Promise<void>;
};

export function createMockFriendsStore(options: MockFriendsStoreOptions): FriendsStore & DemoFriendTools {
  const {
    storage,
    getCurrentUserId,
    makeId = () => crypto.randomUUID(),
    now = () => new Date(),
    today = () => todayKey(),
  } = options;

  function load(): MockFriendsDatabase {
    const raw = storage.getItem(MOCK_FRIENDS_STORAGE_KEY);
    if (!raw) return { friendships: [], sharedStreaks: [] };
    try {
      const parsed = JSON.parse(raw) as Partial<MockFriendsDatabase>;
      return { friendships: parsed.friendships ?? [], sharedStreaks: parsed.sharedStreaks ?? [] };
    } catch {
      return { friendships: [], sharedStreaks: [] };
    }
  }

  function save(db: MockFriendsDatabase) {
    storage.setItem(MOCK_FRIENDS_STORAGE_KEY, JSON.stringify(db));
  }

  /** Everyone's PUBLIC profile (id, username, display name), like the profiles table allows. */
  function profiles(): Map<string, PublicProfile> {
    const db = safeParse<MockDatabase>(storage.getItem(MOCK_STORAGE_KEY), { users: [], profiles: [], currentUserId: null });
    return new Map(db.profiles.map((p) => [p.id, { id: p.id, username: p.username, display_name: p.display_name }]));
  }

  function checkins(): MockCheckinDatabase {
    const empty: MockCheckinDatabase = { habits: [], checkins: [], habitEntries: [] };
    return { ...empty, ...safeParse<Partial<MockCheckinDatabase>>(storage.getItem(MOCK_CHECKIN_STORAGE_KEY), empty) };
  }

  async function requireUser(): Promise<string> {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error("You need to be logged in to see your friends.");
    return userId;
  }

  const involves = (row: { user_a: string; user_b: string }, me: string) => row.user_a === me || row.user_b === me;

  /** My own ACTIVE habit, or an error (like the composite foreign key + the app's rule). */
  function requireMyActiveHabit(me: string, habitId: string) {
    const habit = checkins().habits.find((h) => h.id === habitId && h.user_id === me);
    if (!habit || habit.is_archived) throw new Error("Pick one of your active habits.");
    return habit;
  }

  /** Sam's side of a shared streak: picks (or makes) Sam's habit and accepts. */
  function demoFriendAccepts(streak: SharedStreak) {
    streak.habit_b = demoFriendHabitFor(storage, streak.habit_name, today(), makeId, now());
    streak.status = "active";
  }

  const store: FriendsStore & DemoFriendTools = {
    mode: "mock",

    async findProfileByUsername(username) {
      await requireUser(); // like RLS: profiles are only readable when logged in
      const wanted = normalizeUsername(username);
      return [...profiles().values()].find((p) => p.username === wanted) ?? null;
    },

    async listFriendships() {
      const me = await requireUser();
      const people = profiles();
      return load()
        .friendships.filter((f) => involves(f, me))
        .sort(byCreatedAt)
        .map((f) => toFriendshipView(f, me, people));
    },

    async sendFriendRequest(username) {
      const me = await requireUser();
      const cleaned = cleanFriendUsername(username);
      if (!cleaned.ok) throw new Error(cleaned.error);

      const friend = await store.findProfileByUsername(cleaned.value);
      const db = load();
      const existing = friend ? findPair(db.friendships, me, friend.id) : undefined;
      const check = checkFriendRequest(me, friend, existing);
      if (check.action === "error") throw new Error(check.error);

      let row: Friendship;
      if (check.action === "accept") {
        row = db.friendships.find((f) => f.id === check.friendshipId)!;
        row.status = "accepted";
      } else {
        row = { id: makeId(), user_a: me, user_b: friend!.id, status: "pending", created_at: now().toISOString() };
        // Demo friend Sam says yes straight away.
        if (isDemoFriend(friend!.id)) row.status = "accepted";
        db.friendships.push(row);
      }
      save(db);
      return toFriendshipView(row, me, profiles());
    },

    async respondToFriendRequest(friendshipId, accept) {
      const me = await requireUser();
      const db = load();
      // Only the person who was ASKED (user_b) can answer, and only once.
      const row = db.friendships.find((f) => f.id === friendshipId && f.user_b === me && f.status === "pending");
      if (!row) throw new Error("That friend request doesn't exist any more.");
      if (accept) row.status = "accepted";
      else db.friendships = db.friendships.filter((f) => f.id !== friendshipId); // declining deletes it
      save(db);
    },

    async removeFriendship(friendshipId) {
      const me = await requireUser();
      const db = load();
      const row = db.friendships.find((f) => f.id === friendshipId && involves(f, me));
      if (!row) throw new Error("That friendship doesn't exist any more.");
      db.friendships = db.friendships.filter((f) => f.id !== friendshipId);
      // Like "on delete cascade": the shared streaks of this friendship go too.
      db.sharedStreaks = db.sharedStreaks.filter((s) => s.friendship_id !== friendshipId);
      save(db);
    },

    async listSharedStreaks() {
      const me = await requireUser();
      const people = profiles();
      return load()
        .sharedStreaks.filter((s) => involves(s, me))
        .sort(byCreatedAt)
        .map((s) => toSharedStreakView(s, me, people));
    },

    async createSharedStreak(friendId, habit) {
      const me = await requireUser();
      const db = load();
      const friendship = findPair(db.friendships, me, friendId);
      if (!friendship || friendship.status !== "accepted") throw new Error("You can only share a streak with a friend.");
      const mine = requireMyActiveHabit(me, habit.id);
      if (db.sharedStreaks.some((s) => s.habit_a === mine.id && s.user_a === me && s.user_b === friendId)) {
        throw new Error("You already share this habit with them.");
      }

      const row: SharedStreak = {
        id: makeId(),
        friendship_id: friendship.id,
        habit_name: mine.name, // the name from YOUR habit, not from what the page sent
        user_a: me,
        user_b: friendId,
        habit_a: mine.id,
        habit_b: null,
        status: "pending",
        created_at: now().toISOString(),
      };
      if (isDemoFriend(friendId)) demoFriendAccepts(row);
      db.sharedStreaks.push(row);
      save(db);
      return toSharedStreakView(row, me, profiles());
    },

    async acceptSharedStreak(streakId, myHabitId) {
      const me = await requireUser();
      const db = load();
      const row = db.sharedStreaks.find((s) => s.id === streakId && s.user_b === me && s.status === "pending");
      if (!row) throw new Error("That invite doesn't exist any more.");
      row.habit_b = requireMyActiveHabit(me, myHabitId).id;
      row.status = "active";
      save(db);
    },

    async removeSharedStreak(streakId) {
      const me = await requireUser();
      const db = load();
      if (!db.sharedStreaks.some((s) => s.id === streakId && involves(s, me))) {
        throw new Error("That shared streak doesn't exist any more.");
      }
      db.sharedStreaks = db.sharedStreaks.filter((s) => s.id !== streakId);
      save(db);
    },

    async listSharedStreakDays(streakId, from, to) {
      const me = await requireUser();
      const range = validateDateRange(from, to);
      if (!range.ok) throw new Error(range.error);

      // Same checks as the SQL function: active, I'm in it, still friends.
      // Anything else returns no rows (not an error), like the function.
      const db = load();
      const streak = db.sharedStreaks.find((s) => s.id === streakId && s.status === "active" && involves(s, me));
      const friendship = streak && db.friendships.find((f) => f.id === streak.friendship_id && f.status === "accepted");
      if (!streak || !friendship || !streak.habit_b) return [];

      const { habits, habitEntries } = checkins();
      const days: SharedDay[] = [];
      for (const [habitId, owner] of [
        [streak.habit_a, streak.user_a],
        [streak.habit_b, streak.user_b],
      ]) {
        const habit = habits.find((h) => h.id === habitId && h.user_id === owner);
        if (!habit) continue;
        for (const e of habitEntries) {
          if (e.habit_id !== habitId || e.user_id !== owner || e.date < from || e.date > to) continue;
          // "Done" uses the owner's goal, worked out here; the value itself is never handed out.
          if (isHabitDone(habit, e.value)) days.push({ user_id: owner, date: e.date });
        }
      }
      return days.sort((a, b) => a.date.localeCompare(b.date) || a.user_id.localeCompare(b.user_id));
    },

    // --- demo-only tools -------------------------------------------------
    async addDemoFriend() {
      const me = await requireUser();
      if (isDemoFriend(me)) throw new Error("You're logged in as Sam. Log in as yourself to add Sam.");
      ensureDemoFriendAccount(storage);
      const db = load();
      const existing = findPair(db.friendships, me, DEMO_FRIEND.id);
      if (existing) existing.status = "accepted";
      else {
        db.friendships.push({
          id: makeId(),
          user_a: me,
          user_b: DEMO_FRIEND.id,
          status: "accepted",
          created_at: now().toISOString(),
        });
      }
      save(db);
    },

    async demoFriendChecksInToday() {
      const me = await requireUser();
      // Sam's habits in active shared streaks with me.
      const samHabits = load()
        .sharedStreaks.filter((s) => s.status === "active" && involves(s, me) && involves(s, DEMO_FRIEND.id))
        .map((s) => (s.user_a === DEMO_FRIEND.id ? s.habit_a : s.habit_b))
        .filter((id): id is string => id !== null);
      demoFriendChecksIn(storage, samHabits, today());
    },
  };
  return store;
}

/** JSON.parse that gives `fallback` for missing or broken data instead of crashing. */
function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
