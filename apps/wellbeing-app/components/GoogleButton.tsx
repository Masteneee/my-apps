"use client";

import { useState } from "react";
import { authMode, getAuthService } from "@/lib/auth";
import { buttonSecondary } from "./ui";

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
      <button type="button" onClick={handleClick} disabled={!googleAvailable} className={buttonSecondary}>
        Continue with Google
      </button>
      {!googleAvailable && (
        <p className="mt-2 text-xs text-muted">
          Google login turns on once the Supabase keys are in .env.local (see README).
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
