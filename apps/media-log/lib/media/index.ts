// The one place that decides WHICH media store the app uses, by the same rule
// as auth: Supabase keys set = real database, otherwise the localStorage demo.
// Pages call `getMediaStore()` and never import mock.ts or supabase.ts.

import { authMode, getAuthService } from "../auth";
import { createMemoryStorage } from "../auth/mock";
import { getSupabaseClient } from "../supabase/client";
import { createMockMediaStore } from "./mock";
import { createSupabaseMediaStore } from "./supabase";
import type { MediaStore } from "./types";

export type { LogStatus, LogWithMedia, MediaResult, MediaStore, NewLogInput } from "./types";

let store: MediaStore | null = null;

export function getMediaStore(): MediaStore {
  if (store) return store;

  if (authMode === "supabase") {
    store = createSupabaseMediaStore(getSupabaseClient());
  } else {
    const storage = typeof window === "undefined" ? createMemoryStorage() : window.localStorage;
    store = createMockMediaStore({
      storage,
      // The demo auth knows who is signed in; the demo store just asks it.
      getCurrentUserId: async () => (await getAuthService().getCurrentUser())?.id ?? null,
    });
  }
  return store;
}
