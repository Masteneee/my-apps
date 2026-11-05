import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStorage } from "../auth/mock";
import { createMockCheckinStore } from "./mock";
import { createOfflineAwareStore, overlayEntries, PENDING_SYNC_PREFIX } from "./offline";
import { OfflineError, type CheckinStore } from "./types";

const DAY = "2026-11-05";

// The "server": a demo store in its own storage, standing in for Supabase.
// `networkUp` decides whether requests reach it, like a phone losing signal.
let networkUp: boolean;
let deviceOnline: boolean; // what navigator.onLine would say
let currentUser: string | null;
let serverStorage: ReturnType<typeof createMemoryStorage>;
let deviceStorage: ReturnType<typeof createMemoryStorage>;
let server: CheckinStore;
let store: CheckinStore;
let serverCalls: number;

function flakyServer(inner: CheckinStore): CheckinStore {
  // Every method first checks the "network", like a real fetch would.
  const wrapped = {} as Record<string, unknown>;
  for (const [name, value] of Object.entries(inner)) {
    wrapped[name] =
      typeof value === "function"
        ? async (...args: unknown[]) => {
            serverCalls++;
            if (!networkUp) throw new OfflineError();
            return (value as (...a: unknown[]) => unknown)(...args);
          }
        : value;
  }
  return wrapped as unknown as CheckinStore;
}

beforeEach(() => {
  networkUp = true;
  deviceOnline = true;
  currentUser = "user-a";
  serverCalls = 0;
  serverStorage = createMemoryStorage();
  deviceStorage = createMemoryStorage();
  let n = 0;
  server = createMockCheckinStore({
    storage: serverStorage,
    getCurrentUserId: async () => currentUser,
    makeId: () => `id-${++n}`,
  });
  store = createOfflineAwareStore({
    inner: flakyServer(server),
    storage: deviceStorage,
    getCurrentUserId: async () => currentUser,
    isOnline: () => deviceOnline,
  });
});

function goOffline() {
  networkUp = false;
  deviceOnline = false;
}
function goOnline() {
  networkUp = true;
  deviceOnline = true;
}

describe("offline-aware store: check-ins", () => {
  it("online, it just saves to the server and keeps nothing on the device", async () => {
    await store.saveCheckin(DAY, { mood: 4, journal_text: "private" });
    expect((await server.getCheckin(DAY))?.mood).toBe(4);
    expect(await store.pendingSyncCount()).toBe(0);
    expect(deviceStorage.getItem(PENDING_SYNC_PREFIX + "user-a")).toBeNull();
  });

  it("offline, it keeps partial saves on the device, merged, and shows them", async () => {
    await store.saveCheckin(DAY, { mood: 2 });
    goOffline();
    await store.saveCheckin(DAY, { mood: 4 });
    await store.saveCheckin(DAY, { journal_text: "Written on the bus" });

    expect(await store.pendingSyncCount()).toBe(1); // one day waiting
    const shown = await store.getCheckin(DAY);
    expect(shown?.mood).toBe(4);
    expect(shown?.journal_text).toBe("Written on the bus");
    expect((await server.getCheckin(DAY))?.mood).toBe(2); // server doesn't know yet
  });

  it("sends the waiting changes when back online, and clears them", async () => {
    goOffline();
    await store.saveCheckin(DAY, { mood: 4 });
    await store.saveCheckin(DAY, { gratitude: ["rain"] });
    goOnline();

    expect(await store.syncPending()).toBe(0);
    expect(await server.getCheckin(DAY)).toMatchObject({ mood: 4, gratitude: ["rain", "", ""] });
    expect(deviceStorage.getItem(PENDING_SYNC_PREFIX + "user-a")).toBeNull();
  });

  it("syncs by itself on the next page load (getCheckin)", async () => {
    goOffline();
    await store.saveCheckin(DAY, { mood: 5 });
    goOnline();
    expect((await store.getCheckin(DAY))?.mood).toBe(5);
    expect((await server.getCheckin(DAY))?.mood).toBe(5);
    expect(await store.pendingSyncCount()).toBe(0);
  });

  it("never lets an older waiting change overwrite a newer one", async () => {
    goOffline();
    await store.saveCheckin(DAY, { mood: 2, journal_text: "offline text" });
    goOnline();
    // The next save happens before any sync: it must carry the waiting one too.
    await store.saveCheckin(DAY, { mood: 5 });
    await store.syncPending();
    expect(await server.getCheckin(DAY)).toMatchObject({ mood: 5, journal_text: "offline text" });
  });

  it("treats a failed request as offline even when the phone thinks it's online", async () => {
    networkUp = false; // e.g. wifi connected, but no internet
    await store.saveCheckin(DAY, { mood: 3 });
    expect(await store.pendingSyncCount()).toBe(1);
  });

  it("doesn't even try the network when the device knows it's offline (no slow retries)", async () => {
    goOffline();
    serverCalls = 0;
    await store.saveCheckin(DAY, { mood: 3 });
    await store.getCheckin(DAY);
    expect(serverCalls).toBe(0);
  });

  it("still refuses invalid answers (they never enter the queue)", async () => {
    goOffline();
    await expect(store.saveCheckin(DAY, { mood: 7 })).rejects.toThrow("Mood");
    expect(await store.pendingSyncCount()).toBe(0);
  });

  it("keeps each account's waiting changes apart", async () => {
    goOffline();
    await store.saveCheckin(DAY, { journal_text: "A's journal" });
    currentUser = "user-b";
    expect(await store.getCheckin(DAY)).toBeNull();
    expect(await store.pendingSyncCount()).toBe(0);
  });

  it("drops a waiting change the server refuses (not a network problem), so the queue can't get stuck", async () => {
    goOffline();
    await store.saveCheckin(DAY, { mood: 3 });
    goOnline();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    currentUser = "user-a";
    // Simulate the server refusing: the date is fine, but the server "rejects" it.
    const refusing = createOfflineAwareStore({
      inner: { ...server, saveCheckin: async () => Promise.reject(new Error("refused")) },
      storage: deviceStorage,
      getCurrentUserId: async () => currentUser,
    });
    expect(await refusing.syncPending()).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("offline-aware store: habits", () => {
  it("remembers the habit list for offline use", async () => {
    await server.createHabit({ name: "Read", type: "checkbox" });
    expect((await store.listHabits()).map((h) => h.name)).toEqual(["Read"]); // online: saved a copy
    goOffline();
    expect((await store.listHabits()).map((h) => h.name)).toEqual(["Read"]); // offline: the copy
  });

  it("can't create or archive habits offline, and says why", async () => {
    goOffline();
    await expect(store.createHabit({ name: "Run", type: "checkbox" })).rejects.toThrow("back online");
  });

  it("queues habit ticks offline and sends the newest value", async () => {
    const water = await server.createHabit({ name: "Water", type: "number" });
    await store.saveHabitEntry(water, DAY, 2);
    goOffline();
    await store.saveHabitEntry(water, DAY, 3);
    await store.saveHabitEntry(water, DAY, 4);
    expect(await store.getHabitEntries(DAY)).toEqual([{ habit_id: water.id, user_id: "user-a", date: DAY, value: 4 }]);
    expect(await store.pendingSyncCount()).toBe(1);

    goOnline();
    await store.syncPending();
    expect((await server.getHabitEntries(DAY))[0].value).toBe(4);
    expect(await store.pendingSyncCount()).toBe(0);
  });

  it("queues an untick (remove) too", async () => {
    const stretch = await server.createHabit({ name: "Stretch", type: "checkbox" });
    await store.saveHabitEntry(stretch, DAY, 1);
    goOffline();
    await store.saveHabitEntry(stretch, DAY, null);
    goOnline();
    expect(await store.getHabitEntries(DAY)).toEqual([]);
    expect(await server.getHabitEntries(DAY)).toEqual([]);
  });
});

describe("overlayEntries", () => {
  const server = [
    { habit_id: "h1", user_id: "u", date: DAY, value: 1 },
    { habit_id: "h2", user_id: "u", date: DAY, value: 5 },
  ];

  it("replaces, removes and adds values from the waiting list, for that day only", () => {
    const result = overlayEntries(
      server,
      [
        { habit: { id: "h2", type: "number" }, date: DAY, value: 7 },
        { habit: { id: "h1", type: "checkbox" }, date: DAY, value: null },
        { habit: { id: "h3", type: "minutes" }, date: DAY, value: 20 },
        { habit: { id: "h1", type: "checkbox" }, date: "2026-11-04", value: 1 }, // other day
      ],
      "u",
      DAY,
    );
    expect(result).toEqual([
      { habit_id: "h2", user_id: "u", date: DAY, value: 7 },
      { habit_id: "h3", user_id: "u", date: DAY, value: 20 },
    ]);
  });

  it("returns the server's entries when nothing is waiting", () => {
    expect(overlayEntries(server, [], "u", DAY)).toEqual(server);
  });
});
