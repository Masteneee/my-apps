"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuthService } from "@/lib/auth";
import { useAuth } from "./AuthProvider";

export function NavBar() {
  const { status, profile, profileLoading } = useAuth();
  const router = useRouter();

  async function logOut() {
    await getAuthService().signOut();
    router.push("/");
  }

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80">
      {/* flex-wrap lets the links drop to a second line on very narrow phones. */}
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Media<span className="text-violet-400">Log</span>
        </Link>

        <div className="flex items-center gap-2 text-sm">
          {/* Search works for everyone; logging a result needs an account. */}
          <Link href="/search" className="rounded-md px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white">
            Search
          </Link>
          {/* While loading we show nothing, so the buttons don't flicker. */}
          {status === "signed-out" && (
            <>
              <Link href="/login" className="rounded-md px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-violet-500 px-3 py-2 font-medium text-white hover:bg-violet-400"
              >
                Sign up
              </Link>
            </>
          )}

          {status === "signed-in" && !profileLoading && (
            <>
              {profile && (
                <Link href="/feed" className="rounded-md px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white">
                  Feed
                </Link>
              )}
              <Link
                href={profile ? `/u/${profile.username}` : "/onboarding"}
                className="rounded-md px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              >
                {profile ? "My profile" : "Pick a username"}
              </Link>
              <button
                type="button"
                onClick={logOut}
                className="rounded-md px-3 py-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                Log out
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
