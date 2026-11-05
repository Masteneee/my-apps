// The shapes of data and the "contract" every auth backend must follow.
// Copied from apps/media-log (Stage 1) and trimmed to what this app needs.
//
// Why an interface? The rest of the app only talks to `AuthService`. It never
// imports Supabase directly. That lets us swap in a fake (mock) backend when no
// Supabase keys exist, and the pages don't need to know or care which one runs.

/** A signed-in account. Only what the UI needs, nothing Supabase-specific. */
export type AuthUser = {
  id: string;
  email: string;
};

/** One row of the `profiles` table (see supabase/migrations/). */
export type Profile = {
  id: string; // same as the AuthUser id: one profile per account
  username: string; // always lowercase; friends will find you by it (Stage 4)
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export type SignUpResult = {
  user: AuthUser | null;
  // Supabase can be set to "confirm your email first". In that case sign up
  // succeeds but nobody is signed in until the user clicks the email link.
  needsEmailConfirmation: boolean;
};

export type NewProfile = {
  username: string;
  displayName?: string;
};

export type AuthMode = "supabase" | "mock";

export interface AuthService {
  /** Which backend this is, so the UI can show "demo mode" notes. */
  readonly mode: AuthMode;

  getCurrentUser(): Promise<AuthUser | null>;
  signUp(email: string, password: string): Promise<SignUpResult>;
  signIn(email: string, password: string): Promise<AuthUser>;
  /** Sends the browser to Google, which sends it back to /onboarding. */
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  /**
   * Calls `listener` whenever someone signs in or out.
   * Returns a function that stops listening (call it when a component unmounts).
   */
  onAuthChange(listener: (user: AuthUser | null) => void): () => void;

  /** The profile of this account, or null if no username was picked yet. */
  getProfileForUser(userId: string): Promise<Profile | null>;
  /** Creates the profile of the signed-in user. Throws a friendly Error on failure. */
  createProfile(input: NewProfile): Promise<Profile>;
}
