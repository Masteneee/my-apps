// ONE Supabase client for the whole browser app, shared by the auth backend
// (lib/auth/supabase.ts) and, from Stage 2, the check-in store.
//
// Why share it? The login session lives inside the client. If another store
// made its own client, Supabase would warn about "multiple GoTrueClient
// instances" and the two could disagree about who is logged in.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  // Written out in full so Next.js can copy them into the browser code
  // (see the note in lib/auth/index.ts).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url?.trim() || !anonKey?.trim()) {
    // Only reachable by a bug: the app picks the demo stores when keys are missing.
    throw new Error("Supabase keys are missing. See README.md.");
  }

  // "pkce" is the recommended, more secure login flow for browser apps.
  // The client also reads the login result from the URL when Google sends us back.
  client = createClient(url, anonKey, { auth: { flowType: "pkce" } });
  return client;
}
