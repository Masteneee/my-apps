// Remembers the last profile we loaded, in this browser.
//
// Why? The app must open offline (it's a PWA). In Supabase mode the profile
// comes from the internet, so offline that request fails. Without this file
// the app would think "no profile" and wrongly ask you to pick a username
// again. With it, we show the profile we saw last time.
//
// Only the public profile is kept (username, display name), never check-ins
// or journal text. It is cleared on log out, so the next person using this
// browser doesn't see it.

import type { Profile } from "./types";

/** The three localStorage methods we need. Tests pass a simple in-memory version. */
export type ProfileCacheStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const PROFILE_CACHE_KEY = "wellbeing-app:last-profile";

export function saveCachedProfile(storage: ProfileCacheStorage, profile: Profile): void {
  storage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
}

/**
 * The saved profile, but ONLY if it belongs to `userId`. If someone else
 * logged in on this browser, their old profile must not show up for you.
 */
export function loadCachedProfile(storage: ProfileCacheStorage, userId: string): Profile | null {
  const raw = storage.getItem(PROFILE_CACHE_KEY);
  if (!raw) return null;
  try {
    const profile = JSON.parse(raw) as Partial<Profile> | null;
    // Check the shape a little: broken or hand-edited data counts as "nothing saved".
    if (profile && profile.id === userId && typeof profile.username === "string") {
      return profile as Profile;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearCachedProfile(storage: ProfileCacheStorage): void {
  storage.removeItem(PROFILE_CACHE_KEY);
}
