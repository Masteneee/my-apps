"use client";
// Where everyone lands after signing up or logging in (and after Google).
// - not signed in   -> go to /login
// - has a username  -> go to their profile
// - no username yet -> show the "pick a username" form

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { UsernameForm } from "@/components/UsernameForm";

export default function OnboardingPage() {
  const router = useRouter();
  const { status, user, profile, profileLoading } = useAuth();

  // Redirects happen in an effect: we can't change page in the middle of drawing one.
  useEffect(() => {
    if (status === "signed-out") router.replace("/login");
    if (profile) router.replace(`/u/${profile.username}`);
  }, [status, profile, router]);

  if (status !== "signed-in" || profileLoading || profile || !user) {
    return <p className="text-zinc-400">Loading...</p>;
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-2 text-2xl font-bold">Pick a username</h1>
      <p className="mb-6 text-zinc-400">This is your public name and your profile link. Choose carefully!</p>
      <UsernameForm email={user.email} />
    </div>
  );
}
