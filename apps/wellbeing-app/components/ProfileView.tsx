"use client";
// Your own profile: name, username, email, your data (export, Stage 5), how
// to install the app, log out.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getAuthService } from "@/lib/auth";
import { nameToShow } from "@/lib/home/greeting";
import { useAuth } from "./AuthProvider";
import { Avatar } from "./Avatar";
import { ExportCard } from "./ExportCard";
import { InstallHint } from "./InstallHint";
import { buttonSecondary, card, link } from "./ui";

export function ProfileView() {
  const router = useRouter();
  const { status, user, profile, profileLoading, profileError } = useAuth();
  const needsUsername = status === "signed-in" && !profileLoading && !profile && !profileError;

  useEffect(() => {
    if (status === "signed-out") router.replace("/login");
    if (needsUsername) router.replace("/onboarding");
  }, [status, needsUsername, router]);

  async function logOut() {
    await getAuthService().signOut();
    router.push("/");
  }

  if (status !== "signed-in" || profileLoading || needsUsername || !user) {
    return <p className="text-muted">Loading...</p>;
  }

  return (
    <div className="space-y-5">
      {profile ? (
        <section className="flex items-center gap-4">
          <Avatar name={nameToShow(profile)} size="lg" />
          <div className="min-w-0">
            {/* truncate: a very long name ends with "..." instead of breaking the layout. */}
            <h1 className="truncate text-2xl font-semibold">{nameToShow(profile)}</h1>
            <p className="text-muted">@{profile.username}</p>
          </div>
        </section>
      ) : (
        <p className={card}>{profileError}</p>
      )}

      <section className={card}>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-muted">Email</dt>
            <dd className="break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="text-muted">Friends</dt>
            <dd>
              Friends add you by your username.{" "}
              <Link href="/friends" className={link}>
                Friends and shared streaks
              </Link>
            </dd>
          </div>
        </dl>
      </section>

      <ExportCard />

      <InstallHint />

      <button type="button" onClick={logOut} className={buttonSecondary}>
        Log out
      </button>
    </div>
  );
}
