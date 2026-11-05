"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { Avatar } from "./Avatar";
import { link } from "./ui";

// The top bar: app name on the left, your avatar (or "Log in") on the right.
// Log out lives on the profile page, to keep this bar calm and simple.
export function NavBar() {
  const { status, profile } = useAuth();

  return (
    // pt with safe-area-inset-top: when installed, the bar starts below the phone's notch.
    <header className="border-b border-line pt-[env(safe-area-inset-top)]">
      <nav className="mx-auto flex h-14 max-w-md items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          {/* Same picture as the app icon, drawn small. aria-hidden: it's decoration. */}
          <svg aria-hidden="true" viewBox="0 0 32 32" className="h-6 w-6 text-accent">
            <circle cx="16" cy="16" r="6" fill="currentColor" />
            <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          Wellbeing
        </Link>

        {/* While loading we show nothing, so the buttons don't flicker. */}
        {status === "signed-out" && (
          <Link href="/login" className={`${link} px-2 py-3`}>
            Log in
          </Link>
        )}
        {status === "signed-in" && profile && (
          <Link href="/profile" aria-label="My profile" className="rounded-full">
            <Avatar name={profile.display_name || profile.username} />
          </Link>
        )}
      </nav>
    </header>
  );
}
