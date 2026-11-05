import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStorage } from "../auth/mock";
import { createMockCheckinStore, MOCK_CHECKIN_STORAGE_KEY } from "./mock";
import type { CheckinStore } from "./types";

const DAY = "2026-11-05";

// A tiny fake "who is signed in", so tests can switch users or sign out.
let currentUser: string | null;
let storage: ReturnType<typeof createMemoryStorage>;
let store: CheckinStore;
let clock: Date;

function makeStore() {
  let n = 0;
  return createMockCheckinStore({
    storage,
    getCurrentUserId: async () => currentUser,
    makeId: () => `id-${++n}`,
    now: () => clock,
  });
}

beforeEach(() => {
  currentUser = "user-a";
  storage = createMemoryStorage();
  clock = new Date("2026-11-05T15:00:00.000Z");
  store = makeStore();
});

describe("demo store: check-ins", () => {
  it("has no check-in before the first save", async () => {
    expect(await store.getCheckin(DAY)).toBeNull();
  });

  it("saves step by step into ONE check-in for the day", async () => {
    await store.saveCheckin(DAY, { mood: 4 });
    await store.saveCheckin(DAY, { screen_time_minutes: 120 });
    await store.saveCheckin(DAY, { gratitude: ["tea", "a friend"] });
    const saved = await store.getCheckin(DAY);

    expect(saved).toMatchObject({
      id: "id-1",
      user_id: "user-a",
      date: DAY,
      mood: 4,
      screen_time_minutes: 120,
      gratitude: ["tea", "a friend", ""],
      journal_text: null, // skipped step: still saved, just empty
    });
    const db = JSON.parse(storage.getItem(MOCK_CHECKIN_STORAGE_KEY)!);
    expect(db.checkins).toHaveLength(1);
  });

  it("saves a check-in where everything was skipped", async () => {
    const saved = await store.saveCheckin(DAY, {});
    expect(saved.mood).toBeNull();
    expect(await store.getCheckin(DAY)).not.toBeNull();
  });

  it("keeps the first save time and updates the 'last changed' time", async () => {
    await store.saveCheckin(DAY, { mood: 4 });
    clock = new Date("2026-11-05T21:00:00.000Z");
    const later = await store.saveCheckin(DAY, { mood: 5 });
    expect(later.created_at).toBe("2026-11-05T15:00:00.000Z");
    expect(later.updated_at).toBe("2026-11-05T21:00:00.000Z");
  });

  it("keeps different days apart", async () => {
    await store.saveCheckin(DAY, { mood: 2 });
    await store.saveCheckin("2026-11-06", { mood: 5 });
    expect((await store.getCheckin(DAY))?.mood).toBe(2);
    expect((await store.getCheckin("2026-11-06"))?.mood).toBe(5);
  });

  it("refuses invalid answers and bad dates without saving", async () => {
    await expect(store.saveCheckin(DAY, { mood: 9 })).rejects.toThrow("Mood");
    await expect(store.saveCheckin("2026-02-30", { mood: 3 })).rejects.toThrow("day");
    expect(storage.getItem(MOCK_CHECKIN_STORAGE_KEY)).toBeNull();
  });

  it("needs you to be signed in", async () => {
    currentUser = null;
    await expect(store.saveCheckin(DAY, { mood: 3 })).rejects.toThrow("logged in");
    await expect(store.getCheckin(DAY)).rejects.toThrow("logged in");
  });

  it("never shows one person's check-in (journal!) to another, like RLS", async () => {
    await store.saveCheckin(DAY, { journal_text: "private thoughts" });
    currentUser = "user-b";
    expect(await store.getCheckin(DAY)).toBeNull();
    await store.saveCheckin(DAY, { mood: 1 });
    currentUser = "user-a";
    expect((await store.getCheckin(DAY))?.journal_text).toBe("private thoughts");
    expect((await store.getCheckin(DAY))?.mood).toBeNull();
  });

  it("keeps data after a reload, and starts fresh if the saved data is broken", async () => {
    await store.saveCheckin(DAY, { mood: 4 });
    expect((await makeStore().getCheckin(DAY))?.mood).toBe(4);

    storage.setItem(MOCK_CHECKIN_STORAGE_KEY, "{oops");
    expect(await makeStore().getCheckin(DAY)).toBeNull();
  });

  it("never has anything waiting to sync", async () => {
    await store.saveCheckin(DAY, { mood: 4 });
    expect(await store.pendingSyncCount()).toBe(0);
    expect(await store.syncPending()).toBe(0);
  });
});

describe("demo store: habits", () => {
  it("creates habits and lists them oldest first", async () => {
    const water = await store.createHabit({ name: "Water", type: "number", target: 8, icon: "💧" });
    clock = new Date("2026-11-05T16:00:00.000Z");
    await store.createHabit({ name: "Stretch", type: "checkbox" });

    expect(water).toMatchObject({ name: "Water", type: "number", target: 8, icon: "💧", is_archived: false });
    expect((await store.listHabits()).map((h) => h.name)).toEqual(["Water", "Stretch"]);
  });

  it("refuses two active habits with the same name (any case)", async () => {
    await store.createHabit({ name: "Read", type: "minutes" });
    await expect(store.createHabit({ name: " read ", type: "checkbox" })).rejects.toThrow("already have");
  });

  it("archives a habit: hidden from the check-in, kept in history, can be restored", async () => {
    const read = await store.createHabit({ name: "Read", type: "minutes", target: 20 });
    await store.saveHabitEntry(read, DAY, 25);
    await store.setHabitArchived(read.id, true);

    expect(await store.listHabits()).toEqual([]);
    expect(await store.listHabits({ includeArchived: true })).toHaveLength(1);
    expect(await store.getHabitEntries(DAY)).toHaveLength(1); // history stays

    // A new "Read" is fine while the old one is archived...
    const newRead = await store.createHabit({ name: "Read", type: "checkbox" });
    // ...but then the old one can't come back with the same name.
    await expect(store.setHabitArchived(read.id, false)).rejects.toThrow("already have");
    await store.setHabitArchived(newRead.id, true);
    expect((await store.setHabitArchived(read.id, false)).is_archived).toBe(false);
  });

  it("refuses an invalid habit", async () => {
    await expect(store.createHabit({ name: "", type: "checkbox" })).rejects.toThrow("name");
  });

  it("only shows and changes YOUR habits", async () => {
    const mine = await store.createHabit({ name: "Read", type: "checkbox" });
    currentUser = "user-b";
    expect(await store.listHabits()).toEqual([]);
    await expect(store.setHabitArchived(mine.id, true)).rejects.toThrow("doesn't exist");
    await expect(store.saveHabitEntry(mine, DAY, 1)).rejects.toThrow("doesn't exist");
  });
});

describe("demo store: habit entries", () => {
  it("saves, replaces and removes a day's value", async () => {
    const water = await store.createHabit({ name: "Water", type: "number", target: 8 });
    await store.saveHabitEntry(water, DAY, 3);
    await store.saveHabitEntry(water, DAY, 5);
    expect(await store.getHabitEntries(DAY)).toEqual([{ habit_id: water.id, user_id: "user-a", date: DAY, value: 5 }]);

    expect(await store.saveHabitEntry(water, DAY, 0)).toBeNull(); // 0 = not done = no row
    expect(await store.getHabitEntries(DAY)).toEqual([]);
  });

  it("stores a ticked checkbox as 1", async () => {
    const stretch = await store.createHabit({ name: "Stretch", type: "checkbox" });
    expect((await store.saveHabitEntry(stretch, DAY, 1))?.value).toBe(1);
    expect(await store.saveHabitEntry(stretch, DAY, null)).toBeNull();
  });

  it("refuses an amount that is too big", async () => {
    const read = await store.createHabit({ name: "Read", type: "minutes" });
    await expect(store.saveHabitEntry(read, DAY, 2000)).rejects.toThrow("whole number");
  });
});

describe("demo store: ranges of days (Stage 3, streaks and calendars)", () => {
  it("lists the check-in days in a range, oldest first, with only the date and mood", async () => {
    await store.saveCheckin("2026-11-06", { mood: 5, journal_text: "private" });
    await store.saveCheckin("2026-11-04", { mood: 2 });
    await store.saveCheckin("2026-11-05", { journal_text: "no mood today" });
    await store.saveCheckin("2026-10-01", { mood: 3 }); // outside the range

    const days = await store.listCheckinDays("2026-11-01", "2026-11-06"); // both ends included
    expect(days).toEqual([
      { date: "2026-11-04", mood: 2 },
      { date: "2026-11-05", mood: null },
      { date: "2026-11-06", mood: 5 },
    ]);
    // The journal never comes along.
    expect(JSON.stringify(days)).not.toContain("private");
  });

  it("lists every habit's entries in a range, archived habits included", async () => {
    const stretch = await store.createHabit({ name: "Stretch", type: "checkbox" });
    const water = await store.createHabit({ name: "Water", type: "number", target: 8 });
    await store.saveHabitEntry(stretch, "2026-11-04", 1);
    await store.saveHabitEntry(water, "2026-11-04", 6);
    await store.saveHabitEntry(stretch, "2026-11-05", 1);
    await store.saveHabitEntry(stretch, "2026-11-20", 1); // outside
    await store.setHabitArchived(water.id, true);

    const entries = await store.listHabitEntries("2026-11-04", "2026-11-05");
    expect(entries.map((e) => [e.date, e.value])).toEqual([
      ["2026-11-04", 1],
      ["2026-11-04", 6],
      ["2026-11-05", 1],
    ]);
  });

  it("only shows YOUR days, and refuses a backwards or broken range", async () => {
    await store.saveCheckin(DAY, { mood: 4 });
    currentUser = "user-b";
    expect(await store.listCheckinDays("2026-11-01", "2026-11-30")).toEqual([]);
    expect(await store.listHabitEntries("2026-11-01", "2026-11-30")).toEqual([]);

    await expect(store.listCheckinDays("2026-11-30", "2026-11-01")).rejects.toThrow("after");
    await expect(store.listHabitEntries("yesterday", "2026-11-01")).rejects.toThrow("range");
    currentUser = null;
    await expect(store.listCheckinDays("2026-11-01", "2026-11-30")).rejects.toThrow("logged in");
  });
});
