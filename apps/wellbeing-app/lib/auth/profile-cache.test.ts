import { beforeEach, describe, expect, it } from "vitest";
import {
  clearCachedProfile,
  loadCachedProfile,
  PROFILE_CACHE_KEY,
  saveCachedProfile,
  type ProfileCacheStorage,
} from "./profile-cache";
import type { Profile } from "./types";

// A tiny stand-in for localStorage, so tests don't need a browser.
function memoryStorage(): ProfileCacheStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const ana: Profile = { id: "user-1", username: "ana", display_name: "Ana", avatar_url: null, bio: null };

let storage: ProfileCacheStorage;
beforeEach(() => {
  storage = memoryStorage();
});

describe("profile cache", () => {
  it("has nothing before the first save", () => {
    expect(loadCachedProfile(storage, "user-1")).toBeNull();
  });

  it("gives back the saved profile to the same account", () => {
    saveCachedProfile(storage, ana);
    expect(loadCachedProfile(storage, "user-1")).toEqual(ana);
  });

  it("never gives one account's profile to another account", () => {
    saveCachedProfile(storage, ana);
    expect(loadCachedProfile(storage, "user-2")).toBeNull();
  });

  it("forgets the profile after clearing (log out)", () => {
    saveCachedProfile(storage, ana);
    clearCachedProfile(storage);
    expect(loadCachedProfile(storage, "user-1")).toBeNull();
  });

  it("treats broken or wrongly shaped data as nothing saved", () => {
    storage.setItem(PROFILE_CACHE_KEY, "{not json");
    expect(loadCachedProfile(storage, "user-1")).toBeNull();
    storage.setItem(PROFILE_CACHE_KEY, "null");
    expect(loadCachedProfile(storage, "user-1")).toBeNull();
    storage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ id: "user-1" })); // no username
    expect(loadCachedProfile(storage, "user-1")).toBeNull();
  });
});
