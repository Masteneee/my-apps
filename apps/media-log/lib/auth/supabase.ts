// The REAL auth backend, used when the Supabase keys are set in .env.local.
// Supabase handles passwords, Google login and sessions for us, and stores
// profiles in a Postgres table protected by Row Level Security (RLS).

import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { AuthService, AuthUser, NewProfile, Profile } from "./types";
import { normalizeUsername, validateCredentials, validateDisplayName, validateUsername } from "./validation";

// The columns we read from `profiles`. Listing them (instead of "*") means a new
// column added later won't silently show up in the app.
const PROFILE_COLUMNS = "id, username, display_name, avatar_url, bio";

/**
 * Turns Supabase's technical errors into sentences a user understands.
 * `code` comes from Supabase Auth (e.g. "invalid_credentials") or from
 * Postgres (e.g. "23505" = a unique rule was broken).
 */
export function friendlySupabaseError(error: { code?: string; message: string }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Wrong email or password.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Try logging in.";
    case "email_not_confirmed":
      return "Please confirm your email first (check your inbox).";
    case "weak_password":
      return "That password is too weak. Try a longer one.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many tries. Wait a minute and try again.";
    case "23505": // unique_violation: the username (or this user's profile) already exists
      return "That username is taken. Try another one.";
    case "23514": // check_violation: the database refused the value
      return "That username isn't allowed. Use 3 to 20 letters, numbers or _.";
    case "42501": // RLS said no
      return "You can only edit your own profile. Try logging in again.";
    default:
      return error.message || "Something went wrong. Please try again.";
  }
}

function toAuthUser(user: User | null | undefined): AuthUser | null {
  return user ? { id: user.id, email: user.email ?? "" } : null;
}

// Where Supabase sends the browser back after Google login or an email link.
// /onboarding then asks for a username, or forwards to your profile.
function redirectUrl(): string {
  return `${window.location.origin}/onboarding`;
}

export function createSupabaseAuthService(url: string, anonKey: string): AuthService {
  // "pkce" is the recommended, more secure login flow for browser apps.
  // The client also reads the login result from the URL when Google sends us back.
  const supabase = createClient(url, anonKey, { auth: { flowType: "pkce" } });

  return {
    mode: "supabase",

    async getCurrentUser() {
      // getSession reads the saved session in this browser (fast, no network).
      // It is fine for deciding what the UI shows. The database's RLS rules are
      // what really protect the data, because the server checks the token.
      const { data } = await supabase.auth.getSession();
      return toAuthUser(data.session?.user);
    },

    async signUp(email, password) {
      const problem = validateCredentials(email, password);
      if (problem) throw new Error(problem);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: redirectUrl() },
      });
      if (error) throw new Error(friendlySupabaseError(error));
      // No session = Supabase wants the user to click the confirmation email first.
      return { user: toAuthUser(data.user), needsEmailConfirmation: !data.session };
    },

    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(friendlySupabaseError(error));
      return toAuthUser(data.user)!;
    },

    async signInWithGoogle() {
      // This navigates away to Google. The code after it normally never runs.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectUrl() },
      });
      if (error) throw new Error(friendlySupabaseError(error));
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(friendlySupabaseError(error));
    },

    onAuthChange(listener) {
      // Careful: don't call other Supabase functions directly inside this
      // callback (Supabase warns it can freeze). We only pass the user along.
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        listener(toAuthUser(session?.user));
      });
      return () => data.subscription.unsubscribe();
    },

    async getProfileByUsername(username) {
      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("username", normalizeUsername(username))
        .maybeSingle(); // maybeSingle = "zero or one row", gives null instead of an error
      if (error) throw new Error(friendlySupabaseError(error));
      return (data as Profile | null) ?? null;
    },

    async getProfileForUser(userId) {
      const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
      if (error) throw new Error(friendlySupabaseError(error));
      return (data as Profile | null) ?? null;
    },

    async createProfile(input: NewProfile) {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) throw new Error("You need to be logged in to pick a username.");

      // Check in the browser first for instant, friendly messages.
      // The database checks again (unique + check constraint + RLS).
      const username = validateUsername(input.username);
      if (!username.ok) throw new Error(username.error);
      const displayName = validateDisplayName(input.displayName ?? "");
      if (!displayName.ok) throw new Error(displayName.error);

      const { data, error } = await supabase
        .from("profiles")
        .insert({ id: user.id, username: username.value, display_name: displayName.value || null })
        .select(PROFILE_COLUMNS)
        .single();
      if (error) throw new Error(friendlySupabaseError(error));
      return data as Profile;
    },
  };
}
