"use client";
// The home page. What it shows depends on who is looking:
// - signed out       -> a short welcome with "Create an account" / "Log in"
// - no username yet  -> sent to /onboarding
// - signed in        -> "Today": the check-in card (Stage 2), the streaks card (Stage 3)
//                       and the friends card with the "your turn" nudge (Stage 4)

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { greetingFor, nameToShow } from "@/lib/home/greeting";
import { useAuth } from "./AuthProvider";
import { FriendsCard } from "./friends/FriendsCard";
import { StreaksCard } from "./streaks/StreaksCard";
import { TodayCheckinCard } from "./TodayCheckinCard";
import { buttonPrimary, buttonSecondary, card } from "./ui";

// What the daily check-in covers. Shown on the welcome screen.
const CHECKIN_PARTS = ["Mood", "Screen time", "3 gratitudes", "A short journal", "Your habits"];

export function HomeView() {
  const router = useRouter();
  const { status, profile, profileLoading, profileError, refreshProfile } = useAuth();
  const needsUsername = status === "signed-in" && !profileLoading && !profile && !profileError;

  // Redirects happen in an effect: we can't change page in the middle of drawing one.
  useEffect(() => {
    if (needsUsername) router.replace("/onboarding");
  }, [needsUsername, router]);

  if (status === "loading" || profileLoading || needsUsername) {
    return <p className="text-muted">Loading...</p>;
  }

  if (status === "signed-out") return <Welcome />;

  if (!profile) {
    // Signed in, but the profile couldn't load (offline the very first time).
    return (
      <div className={card}>
        <p>{profileError}</p>
        <button type="button" onClick={refreshProfile} className={`mt-4 ${buttonSecondary}`}>
          Try again
        </button>
      </div>
    );
  }

  // The time and date come from this device's clock, in its own time zone.
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted">{today}</p>
        <h1 className="mt-1 text-2xl font-semibold">
          {greetingFor(now.getHours())}, {nameToShow(profile)}
        </h1>
      </header>

      <TodayCheckinCard />

      <StreaksCard />

      <FriendsCard />
    </div>
  );
}

function Welcome() {
  return (
    <div className="space-y-6 pt-4">
      <div>
        <h1 className="text-3xl font-semibold leading-tight">A calm 5-minute check-in, every day.</h1>
        <p className="mt-3 text-muted">
          Track how you feel and the small habits that help, in one quick flow. Keep a streak going with a friend.
        </p>
      </div>

      <ul className="flex flex-wrap gap-2" aria-label="What the check-in covers">
        {CHECKIN_PARTS.map((part) => (
          <li key={part} className="rounded-full bg-accent-soft px-3 py-1 text-sm text-accent">
            {part}
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        <Link href="/signup" className={buttonPrimary}>
          Create an account
        </Link>
        <Link href="/login" className={buttonSecondary}>
          Log in
        </Link>
      </div>

      <p className="text-xs text-muted">Your journal is private: only you can ever read it.</p>
    </div>
  );
}
