// DEMO MODE ONLY: "Sam", a pretend friend who lives in this browser.
//
// Demo mode keeps everything in one browser, so there's no real second person
// to be friends with. Two ways to try friends anyway:
//  1. The quick way (this file): the "Add Sam, a demo friend" button on
//     /friends. Sam is a real demo account in localStorage. Sam accepts your
//     friend request and your shared-streak invites right away, and already
//     "did" the habit on most of the last 2 weeks (and today), so you see a
//     streak and the "your turn" nudge at once. A "Sam checks in today"
//     button adds today again on a later day.
//  2. The real way: sign up a second account in the same browser, log out,
//     log in as the other one... It works (both are demo accounts), it's just slower.
// You can also log in AS Sam (email below) to see the other side.
//
// Nothing here runs in Supabase mode: lib/friends/index.ts only hands these
// tools out in demo mode.

import { MOCK_STORAGE_KEY, type KeyValueStorage, type MockDatabase } from "../auth/mock";
import { addDays } from "../checkin/date";
import { MOCK_CHECKIN_STORAGE_KEY, type MockCheckinDatabase } from "../checkin/mock";
import type { Habit } from "../checkin/types";
import type { PublicProfile } from "./types";

export const DEMO_FRIEND = {
  id: "demo-friend-sam",
  email: "sam@demo.local",
  // Shown in README so you can log in as Sam. Demo accounts only, never real.
  password: "demo-friend",
  username: "sam_demo",
  display_name: "Sam (demo)",
} as const;

/** Sam's made-up history when a shared streak starts: the last 14 days, today included... */
export const DEMO_HISTORY_DAYS = 14;
/** ...except these days (3 and 8 days ago), so you can see what a missed day does. */
export const DEMO_MISSED_DAYS_AGO = [3, 8];

export function isDemoFriend(userId: string): boolean {
  return userId === DEMO_FRIEND.id;
}

// Small JSON helpers: read a whole demo database, or start from `fallback`.
function readJson<T>(storage: KeyValueStorage, key: string, fallback: T): T {
  const raw = storage.getItem(key);
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return fallback;
  }
}

function readCheckins(storage: KeyValueStorage): MockCheckinDatabase {
  return readJson<MockCheckinDatabase>(storage, MOCK_CHECKIN_STORAGE_KEY, { habits: [], checkins: [], habitEntries: [] });
}

/** Creates Sam's demo account and profile, if they don't exist yet. Returns Sam's profile. */
export function ensureDemoFriendAccount(storage: KeyValueStorage): PublicProfile {
  const db = readJson<MockDatabase>(storage, MOCK_STORAGE_KEY, { users: [], profiles: [], currentUserId: null });
  if (!db.users.some((u) => u.id === DEMO_FRIEND.id)) {
    db.users.push({ id: DEMO_FRIEND.id, email: DEMO_FRIEND.email, password: DEMO_FRIEND.password });
  }
  if (!db.profiles.some((p) => p.id === DEMO_FRIEND.id)) {
    db.profiles.push({
      id: DEMO_FRIEND.id,
      username: DEMO_FRIEND.username,
      display_name: DEMO_FRIEND.display_name,
      avatar_url: null,
      bio: null,
    });
  }
  storage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
  return { id: DEMO_FRIEND.id, username: DEMO_FRIEND.username, display_name: DEMO_FRIEND.display_name };
}

/**
 * Sam's habit for a shared streak on `habitName`: Sam's active habit with that
 * name, or a new yes/no one with the made-up history above. Returns its id.
 */
export function demoFriendHabitFor(
  storage: KeyValueStorage,
  habitName: string,
  today: string,
  makeId: () => string,
  now: Date,
): string {
  const db = readCheckins(storage);
  const same = (h: Habit) =>
    h.user_id === DEMO_FRIEND.id && !h.is_archived && h.name.trim().toLowerCase() === habitName.trim().toLowerCase();
  const existing = db.habits.find(same);
  if (existing) return existing.id;

  const habit: Habit = {
    id: makeId(),
    user_id: DEMO_FRIEND.id,
    name: habitName,
    icon: null,
    type: "checkbox",
    target: null,
    is_archived: false,
    created_at: now.toISOString(),
  };
  db.habits.push(habit);
  for (let daysAgo = 0; daysAgo < DEMO_HISTORY_DAYS; daysAgo++) {
    if (DEMO_MISSED_DAYS_AGO.includes(daysAgo)) continue;
    db.habitEntries.push({ habit_id: habit.id, user_id: DEMO_FRIEND.id, date: addDays(today, -daysAgo), value: 1 });
  }
  storage.setItem(MOCK_CHECKIN_STORAGE_KEY, JSON.stringify(db));
  return habit.id;
}

/** "Sam checks in today": marks each of these Sam habits done today (once). */
export function demoFriendChecksIn(storage: KeyValueStorage, habitIds: string[], today: string): void {
  const db = readCheckins(storage);
  for (const habitId of habitIds) {
    const done = db.habitEntries.some((e) => e.habit_id === habitId && e.date === today);
    if (!done) db.habitEntries.push({ habit_id: habitId, user_id: DEMO_FRIEND.id, date: today, value: 1 });
  }
  storage.setItem(MOCK_CHECKIN_STORAGE_KEY, JSON.stringify(db));
}
