"use client";
// A custom React "hook": a function starting with `use` that bundles state and
// effects so several components can share them. The profile page and the diary
// page both need "this username's profile and everything they logged", so the
// loading code lives here once (it used to be inside ProfileView).

import { useEffect, useState } from "react";
import { getAuthService, type Profile } from "@/lib/auth";
import { normalizeUsername } from "@/lib/auth/validation";
import { getMediaStore, type LogWithMedia } from "@/lib/media";

// The result of looking up a username. We keep the username we looked up next
// to the result, so after navigating to another profile we know the old
// result is stale and show "Loading" instead of the wrong person.
export type ProfileLookup = {
  username: string;
  profile: Profile | null;
  logs: LogWithMedia[]; // newest first
  error: string | null; // the profile itself couldn't load
  logsError: string | null; // the profile loaded, but its logs didn't
};

// Loads the profile, then (if it exists) its logs. Kept outside the hook
// because it doesn't need any React state.
async function loadProfileLogs(username: string): Promise<ProfileLookup> {
  const profile = await getAuthService().getProfileByUsername(username);
  if (!profile) return { username, profile: null, logs: [], error: null, logsError: null };
  try {
    const logs = await getMediaStore().getLogsForUser(profile.id);
    return { username, profile, logs, error: null, logsError: null };
  } catch (err) {
    // e.g. the Stage 2 tables don't exist yet: still show the profile, plus the reason.
    const message = err instanceof Error ? err.message : "Could not load the logs.";
    return { username, profile, logs: [], error: null, logsError: message };
  }
}

/**
 * Returns the cleaned username and its lookup. `lookup` is null while loading
 * (including while switching from one username to another).
 */
export function useProfileLogs(username: string): { wanted: string; lookup: ProfileLookup | null } {
  const [lookup, setLookup] = useState<ProfileLookup | null>(null);
  const wanted = normalizeUsername(username);

  useEffect(() => {
    let cancelled = false;
    loadProfileLogs(wanted)
      .then((result) => {
        if (!cancelled) setLookup(result);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not load this profile.";
        if (!cancelled) setLookup({ username: wanted, profile: null, logs: [], error: message, logsError: null });
      });
    return () => {
      cancelled = true;
    };
  }, [wanted]);

  // An answer for a different username is stale: treat it as "still loading".
  return { wanted, lookup: lookup && lookup.username === wanted ? lookup : null };
}
