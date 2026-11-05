"use client";
// For pages that need a logged-in user WITH a username (check-in, habits).
// Same rules as the profile page: signed out -> /login, no username -> /onboarding.

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";

export function useRequireAccount() {
  const router = useRouter();
  const { status, user, profile, profileLoading, profileError } = useAuth();
  const needsUsername = status === "signed-in" && !profileLoading && !profile && !profileError;

  // Redirects happen in an effect: we can't change page in the middle of drawing one.
  useEffect(() => {
    if (status === "signed-out") router.replace("/login");
    if (needsUsername) router.replace("/onboarding");
  }, [status, needsUsername, router]);

  // "ready" = signed in, and we know the profile (or we're offline with no copy
  // of it, which is fine here: the check-in doesn't need the username).
  const ready = status === "signed-in" && !profileLoading && !needsUsername && user !== null;
  return { ready, user, profile };
}
