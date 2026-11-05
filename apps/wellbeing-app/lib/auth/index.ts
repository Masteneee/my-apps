// The one place that decides WHICH auth backend the app uses.
// Pages and components call `getAuthService()` and never import mock.ts or
// supabase.ts themselves.

import { createMemoryStorage, createMockAuthService } from "./mock";
import { getSupabaseClient } from "../supabase/client";
import { createSupabaseAuthService } from "./supabase";
import type { AuthMode, AuthService } from "./types";

export type { AuthMode, AuthService, AuthUser, NewProfile, Profile } from "./types";

/** Real Supabase only if BOTH values are filled in, otherwise the mock. */
export function pickAuthMode(url: string | undefined, anonKey: string | undefined): AuthMode {
  return url?.trim() && anonKey?.trim() ? "supabase" : "mock";
}

// Next.js copies NEXT_PUBLIC_ variables into the browser code at build time.
// It only does that for the exact text `process.env.NEXT_PUBLIC_...`, so we
// must write them out in full like this (not process.env[someName]).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const authMode: AuthMode = pickAuthMode(SUPABASE_URL, SUPABASE_ANON_KEY);

// We create the service once and reuse it (a "singleton"). Making a new
// Supabase client on every render would be slow and lose listeners.
let service: AuthService | null = null;

export function getAuthService(): AuthService {
  if (service) return service;

  if (authMode === "supabase") {
    service = createSupabaseAuthService(getSupabaseClient());
  } else {
    // localStorage only exists in the browser. On the server (during the
    // build or the first render) we fall back to a throwaway in-memory store.
    const storage = typeof window === "undefined" ? createMemoryStorage() : window.localStorage;
    service = createMockAuthService(storage);
  }
  return service;
}
