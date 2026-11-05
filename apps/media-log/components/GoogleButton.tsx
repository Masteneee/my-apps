"use client";

import { useState } from "react";
import { authMode, getAuthService } from "@/lib/auth";

export function GoogleButton() {
  // Only a real Supabase project can talk to Google.
  const googleAvailable = authMode === "supabase";
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    try {
      // In Supabase mode this leaves our site and goes to Google.
      await getAuthService().signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google login failed.");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={!googleAvailable}
        className="w-full rounded-md border border-zinc-700 px-4 py-2.5 font-medium hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
      >
        Continue with Google
      </button>
      {!googleAvailable && (
        <p className="mt-2 text-xs text-zinc-500">
          Google login needs a Supabase project. It turns on once the keys are in .env.local (see README).
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
