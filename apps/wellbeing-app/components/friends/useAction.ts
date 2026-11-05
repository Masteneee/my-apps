"use client";
// Small helpers shared by the /friends page's sections.

import { useState } from "react";

/** A small button for rows (Accept, Decline, Remove...). min-h-11 = 44px, still easy to tap. */
export const smallButton =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-3 text-sm font-medium hover:bg-accent-soft disabled:opacity-50";

/**
 * Runs one action (accept, remove...), shows its error if it fails, and
 * reloads the data when it's done. Shared by this page's sections.
 */
export function useAction(reload: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await action();
      reload();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}
