"use client";
// One form used by both /login and /signup (they only differ in a few words
// and in which auth function they call). Copied from apps/media-log.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAuthService } from "@/lib/auth";
import { GoogleButton } from "./GoogleButton";
import { buttonPrimary, card, input, label, link } from "./ui";

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
      // /onboarding asks for a username, or forwards to the home page if you have one.
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
      <div className={card}>
        <h2 className="text-lg font-semibold">Check your inbox</h2>
        <p className="mt-2 text-muted">
          We sent a confirmation link to <strong className="text-ink">{email}</strong>. Tap it to finish signing up,
          then pick your username.
        </p>
      </div>
    );
  }

  return (
    <div className={card}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className={label}>
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email" // phones show the keyboard with "@"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="password" className={label}>
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
            className={input}
          />
          {isSignup && <p className="mt-1 text-xs text-muted">At least 6 characters.</p>}
        </div>

        {/* role="alert" makes screen readers announce the error right away. */}
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className={buttonPrimary}>
          {busy ? "Please wait..." : isSignup ? "Create account" : "Log in"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <GoogleButton />

      <p className="mt-6 text-center text-sm text-muted">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link href={isSignup ? "/login" : "/signup"} className={link}>
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
