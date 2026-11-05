// The one place that decides WHICH check-in store the app uses, by the same
// rule as auth (lib/auth/index.ts): Supabase keys set = real database,
// otherwise the localStorage demo. Pages call `getCheckinStore()` and never
// import mock.ts, supabase.ts or offline.ts themselves.

import { authMode, getAuthService } from "../auth";
import { createMemoryStorage } from "../auth/mock";
import { getSupabaseClient } from "../supabase/client";
import { createMockCheckinStore } from "./mock";
import { createOfflineAwareStore } from "./offline";
import { createSupabaseCheckinStore } from "./supabase";
import type { CheckinStore } from "./types";

export type {
  Checkin,
  CheckinDay,
  CheckinFields,
  CheckinPatch,
  CheckinStore,
  Habit,
  HabitEntry,
  HabitType,
  NewHabit,
} from "./types";
export { OfflineError } from "./types";

let store: CheckinStore | null = null;

export function getCheckinStore(): CheckinStore {
  if (store) return store;

  // localStorage only exists in the browser (not during the build on the server).
  const storage = typeof window === "undefined" ? createMemoryStorage() : window.localStorage;
  // Both stores ask the auth service who is signed in.
  const getCurrentUserId = async () => (await getAuthService().getCurrentUser())?.id ?? null;

  if (authMode === "supabase") {
    store = createOfflineAwareStore({
      inner: createSupabaseCheckinStore(getSupabaseClient()),
      storage,
      getCurrentUserId,
      // navigator.onLine is false when the device KNOWS it has no network.
      // (true doesn't guarantee the internet works; failed requests are caught too.)
      isOnline: () => typeof navigator === "undefined" || navigator.onLine,
    });
  } else {
    store = createMockCheckinStore({ storage, getCurrentUserId });
  }
  return store;
}
