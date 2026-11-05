"use client";
// "use client" = this code runs in the browser. It needs to, because it reads
// the login session (stored in the browser) and reacts to sign in / sign out.
// Copied from apps/media-log, plus the offline profile cache (lib/auth/profile-cache.ts).

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getAuthService, type AuthUser, type Profile } from "@/lib/auth";
import { clearCachedProfile, loadCachedProfile, saveCachedProfile } from "@/lib/auth/profile-cache";

type AuthState = {
  // "loading" while we don't know yet (first moment after the page opens).
  status: "loading" | "signed-out" | "signed-in";
  user: AuthUser | null;
  profile: Profile | null; // null if signed out OR signed in without a username yet
  profileLoading: boolean;
  /** Set when the profile couldn't be loaded (e.g. offline) and none was saved before. */
  profileError: string | null;
  /** Re-read the profile, e.g. right after picking a username. */
  refreshProfile: () => Promise<void>;
};

// A React "context" lets any component read the auth state with useAuth(),
// without passing it down through every component by hand.
const AuthContext = createContext<AuthState | null>(null);

// The profile we loaded, plus which user it belongs to. Remembering the owner
// lets us notice when it's stale (a different user signed in).
type LoadedProfile = { userId: string; profile: Profile | null; error: string | null };

// localStorage only exists in the browser (not during the build on the server).
function storage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

/** Loads the profile; if the network fails, falls back to the copy saved last time. */
async function loadProfile(userId: string): Promise<LoadedProfile> {
  const saved = storage();
  try {
    const profile = await getAuthService().getProfileForUser(userId);
    if (saved) {
      if (profile) saveCachedProfile(saved, profile);
      else clearCachedProfile(saved);
    }
    return { userId, profile, error: null };
  } catch {
    const cached = saved ? loadCachedProfile(saved, userId) : null;
    // With a saved copy, offline is no problem. Without one we must NOT say
    // "no profile", or the app would ask for a username you already picked.
    return { userId, profile: cached, error: cached ? null : "Couldn't load your profile. Check your connection." };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userLoaded, setUserLoaded] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState<LoadedProfile | null>(null);

  // 1) On page load: who is signed in? And keep listening for changes.
  useEffect(() => {
    const auth = getAuthService();
    let cancelled = false; // avoids setting state after the component is gone

    auth.getCurrentUser().then((current) => {
      if (cancelled) return;
      setUser(current);
      setUserLoaded(true);
    });

    const stopListening = auth.onAuthChange((changed) => {
      // Logged out: forget the saved profile so the next person on this device doesn't see it.
      const saved = storage();
      if (!changed && saved) clearCachedProfile(saved);
      setUser(changed);
      setUserLoaded(true);
    });

    // React calls this "cleanup" function when the component unmounts.
    return () => {
      cancelled = true;
      stopListening();
    };
  }, []);

  // 2) Whenever the signed-in user changes, load their profile.
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadProfile(userId).then((result) => {
      if (!cancelled) setLoaded(result);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    setLoaded(await loadProfile(userId));
  }, [userId]);

  // Values "derived" from the state above. Computing them here (instead of
  // storing them in more state) means they can never get out of sync.
  const profileIsCurrent = loaded !== null && loaded.userId === userId;
  const value: AuthState = {
    status: !userLoaded ? "loading" : user ? "signed-in" : "signed-out",
    user,
    profile: profileIsCurrent ? loaded.profile : null,
    profileLoading: userId !== null && !profileIsCurrent,
    profileError: profileIsCurrent ? loaded.error : null,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Read the auth state from any component inside <AuthProvider>. */
export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
