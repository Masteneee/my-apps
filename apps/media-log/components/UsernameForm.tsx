"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getAuthService } from "@/lib/auth";
import { suggestUsername, USERNAME_MAX, validateUsername } from "@/lib/auth/validation";
import { useAuth } from "./AuthProvider";

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
      const profile = await getAuthService().createProfile({ username, displayName });
      await refreshProfile(); // so the nav bar shows "My profile" right away
      router.push(`/u/${profile.username}`);
    } catch (err) {
      // e.g. "That username is taken" (only the backend can know that)
      setError(err instanceof Error ? err.message : "Could not save your username.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-zinc-300">
          Username
        </label>
        <div className="mt-1 flex items-center rounded-md border border-zinc-700 bg-zinc-950 focus-within:border-violet-400">
          <span className="pl-3 text-zinc-500">@</span>
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
            className="w-full bg-transparent px-1 py-2 outline-none"
          />
        </div>
        <p id="username-help" className={`mt-1 text-xs ${check.ok ? "text-zinc-500" : "text-amber-300"}`}>
          {check.ok ? `Your profile will be at /u/${check.value}` : check.error}
        </p>
      </div>

      <div>
        <label htmlFor="display-name" className="block text-sm font-medium text-zinc-300">
          Display name <span className="text-zinc-500">(optional)</span>
        </label>
        <input
          id="display-name"
          maxLength={50}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How your name appears on your profile"
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none placeholder:text-zinc-600 focus:border-violet-400"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !check.ok}
        className="w-full rounded-md bg-violet-500 px-4 py-2.5 font-medium text-white hover:bg-violet-400 disabled:opacity-60"
      >
        {busy ? "Saving..." : "Save and see my profile"}
      </button>
    </form>
  );
}
