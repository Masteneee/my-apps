"use client";
// One form used by both /login and /signup (they only differ in a few words
// and in which auth function they call).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAuthService } from "@/lib/auth";
import { GoogleButton } from "./GoogleButton";

type Props = { kind: "login" | "signup" };

export function AuthForm({ kind }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkInbox, setCheckInbox] = useState(false);

  const isSignup = kind === "signup";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Without this the browser would reload the page (old-school form submit).
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const auth = getAuthService();
      if (isSignup) {
        const result = await auth.signUp(email, password);
        if (result.needsEmailConfirmation) {
          setCheckInbox(true);
          return;
        }
      } else {
        await auth.signIn(email, password);
      }
      // /onboarding asks for a username, or forwards to your profile if you have one.
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      // "finally" runs whether it worked or failed, so the button never stays stuck.
      setBusy(false);
    }
  }

  if (checkInbox) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold">Check your inbox</h2>
        <p className="mt-2 text-zinc-400">
          We sent a confirmation link to <strong className="text-zinc-200">{email}</strong>. Click it to finish signing
          up, then pick your username.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-violet-400"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            // Tells password managers whether to suggest a new password or fill a saved one.
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-violet-400"
          />
          {isSignup && <p className="mt-1 text-xs text-zinc-500">At least 6 characters.</p>}
        </div>

        {/* role="alert" makes screen readers announce the error right away. */}
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-violet-500 px-4 py-2.5 font-medium text-white hover:bg-violet-400 disabled:opacity-60"
        >
          {busy ? "Please wait..." : isSignup ? "Create account" : "Log in"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-zinc-500">
        <span className="h-px flex-1 bg-zinc-800" />
        or
        <span className="h-px flex-1 bg-zinc-800" />
      </div>

      <GoogleButton />

      <p className="mt-6 text-center text-sm text-zinc-400">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link href={isSignup ? "/login" : "/signup"} className="text-violet-400 hover:underline">
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
