"use client";
// "use client" = this code runs in the browser. It needs to, because it reads
// the login session (stored in the browser) and reacts to sign in / sign out.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getAuthService, type AuthUser, type Profile } from "@/lib/auth";

type AuthState = {
  // "loading" while we don't know yet (first moment after the page opens).
  status: "loading" | "signed-out" | "signed-in";
  user: AuthUser | null;
  profile: Profile | null; // null if signed out OR signed in without a username yet
  profileLoading: boolean;
  /** Re-read the profile, e.g. right after picking a username. */
  refreshProfile: () => Promise<void>;
};

// A React "context" lets any component read the auth state with useAuth(),
// without passing it down through every component by hand.
const AuthContext = createContext<AuthState | null>(null);

// The profile we loaded, plus which user it belongs to. Remembering the owner
// lets us notice when it's stale (a different user signed in).
type LoadedProfile = { userId: string; profile: Profile | null };

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
    getAuthService()
      .getProfileForUser(userId)
      .then((profile) => {
        if (!cancelled) setLoaded({ userId, profile });
      })
      .catch(() => {
        // If loading fails (e.g. offline), act like there's no profile yet.
        if (!cancelled) setLoaded({ userId, profile: null });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const profile = await getAuthService().getProfileForUser(userId);
    setLoaded({ userId, profile });
  }, [userId]);

  // Values "derived" from the state above. Computing them here (instead of
  // storing them in more state) means they can never get out of sync.
  const profileIsCurrent = loaded !== null && loaded.userId === userId;
  const value: AuthState = {
    status: !userLoaded ? "loading" : user ? "signed-in" : "signed-out",
    user,
    profile: profileIsCurrent ? loaded.profile : null,
    profileLoading: userId !== null && !profileIsCurrent,
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
