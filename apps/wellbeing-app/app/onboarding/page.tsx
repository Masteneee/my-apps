"use client";
// Where everyone lands after signing up or logging in (and after Google).
// Copied from apps/media-log:
// - not signed in   -> go to /login
// - has a username  -> go to the home page
// - no username yet -> show the "pick a username" form

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { UsernameForm } from "@/components/UsernameForm";
import { card } from "@/components/ui";

export default function OnboardingPage() {
  const router = useRouter();
  const { status, user, profile, profileLoading, profileError } = useAuth();

  // Redirects happen in an effect: we can't change page in the middle of drawing one.
  useEffect(() => {
    if (status === "signed-out") router.replace("/login");
    if (profile) router.replace("/");
  }, [status, profile, router]);

  if (status !== "signed-in" || profileLoading || profile || !user) {
    return <p className="text-muted">Loading...</p>;
  }

  // Offline and we don't know yet if you have a username: don't ask for a new one.
  if (profileError) return <p className={card}>{profileError}</p>;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">Pick a username</h1>
      <p className="mb-6 text-muted">Friends will use it to find you. You can keep it private otherwise.</p>
      <UsernameForm email={user.email} />
    </div>
  );
}
