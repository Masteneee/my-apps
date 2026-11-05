// The one place that decides WHICH friends store the app uses, by the same
// rule as auth and check-ins: Supabase keys set = real database, otherwise
// the localStorage demo. Pages call `getFriendsStore()` and never import
// mock.ts or supabase.ts themselves.

import { authMode, getAuthService } from "../auth";
import { createMemoryStorage } from "../auth/mock";
import { getSupabaseClient } from "../supabase/client";
import { createMockFriendsStore, type DemoFriendTools } from "./mock";
import { createSupabaseFriendsStore } from "./supabase";
import type { FriendsStore } from "./types";

export type { FriendshipView, FriendsStore, PublicProfile, SharedDay, SharedStreakView } from "./types";
export type { DemoFriendTools } from "./mock";

let store: (FriendsStore & Partial<DemoFriendTools>) | null = null;

function getStore(): FriendsStore & Partial<DemoFriendTools> {
  if (store) return store;
  if (authMode === "supabase") {
    store = createSupabaseFriendsStore(getSupabaseClient());
  } else {
    const storage = typeof window === "undefined" ? createMemoryStorage() : window.localStorage;
    store = createMockFriendsStore({
      storage,
      getCurrentUserId: async () => (await getAuthService().getCurrentUser())?.id ?? null,
    });
  }
  return store;
}

export function getFriendsStore(): FriendsStore {
  return getStore();
}

/** The demo friend buttons ("Add Sam", "Sam checks in today"), or null in Supabase mode. */
export function getDemoFriendTools(): DemoFriendTools | null {
  const current = getStore();
  return current.addDemoFriend && current.demoFriendChecksInToday ? (current as DemoFriendTools) : null;
}
