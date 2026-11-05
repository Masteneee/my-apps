"use client";
// Copied from apps/media-log. After saving we go to the home page.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAuthService } from "@/lib/auth";
import { DISPLAY_NAME_MAX, suggestUsername, USERNAME_MAX, validateUsername } from "@/lib/auth/validation";
import { useAuth } from "./AuthProvider";
import { buttonPrimary, card, input, label } from "./ui";

export function UsernameForm({ email }: { email: string }) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  // The function form of useState runs only once, on the first render.
  const [username, setUsername] = useState(() => suggestUsername(email));
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Checked on every keystroke, so the user sees problems before submitting.
  const check = validateUsername(username);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!check.ok) return;
    setError(null);
    setBusy(true);
    try {
      await getAuthService().createProfile({ username, displayName });
      await refreshProfile(); // so the top bar shows your avatar right away
      router.push("/");
    } catch (err) {
      // e.g. "That username is taken" (only the backend can know that)
      setError(err instanceof Error ? err.message : "Could not save your username.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${card}`}>
      <div>
        <label htmlFor="username" className={label}>
          Username
        </label>
        <div className="mt-1 flex min-h-12 items-center rounded-xl border border-line bg-page focus-within:border-accent">
          <span className="pl-3 text-muted">@</span>
          <input
            id="username"
            required
            maxLength={USERNAME_MAX}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-describedby="username-help"
            className="w-full bg-transparent px-1 text-base outline-none"
          />
        </div>
        <p id="username-help" className={`mt-1 text-xs ${check.ok ? "text-muted" : "text-amber-700 dark:text-amber-300"}`}>
          {check.ok ? `Friends will find you as @${check.value}` : check.error}
        </p>
      </div>

      <div>
        <label htmlFor="display-name" className={label}>
          Display name <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="display-name"
          maxLength={DISPLAY_NAME_MAX}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="What should we call you?"
          className={input}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy || !check.ok} className={buttonPrimary}>
        {busy ? "Saving..." : "Save and continue"}
      </button>
    </form>
  );
}
