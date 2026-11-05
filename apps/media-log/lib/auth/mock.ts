// A FAKE auth backend that keeps everything in the browser's localStorage.
// It's used when no Supabase keys are set, so you can try sign up, username
// and profile pages with zero setup.
//
// Limits (on purpose, it's only for local testing):
// - Data lives in ONE browser. Another browser or device sees nothing.
// - Passwords are stored as plain text in localStorage. That is fine for a
//   throwaway demo on your own computer and NEVER okay in a real app.
//   Real apps (and our Supabase mode) never store passwords themselves.

import type { AuthService, AuthUser, NewProfile, Profile, SignUpResult } from "./types";
import { normalizeUsername, validateCredentials, validateDisplayName, validateUsername } from "./validation";

/** The two methods we need from localStorage. Tests pass a simple in-memory version. */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

type MockUser = AuthUser & { password: string };

// Everything the mock "database" holds, saved as one JSON string.
type MockDatabase = {
  users: MockUser[];
  profiles: Profile[];
  currentUserId: string | null; // who is signed in right now (the "session")
};

export const MOCK_STORAGE_KEY = "media-log:mock-db";

const emptyDatabase = (): MockDatabase => ({ users: [], profiles: [], currentUserId: null });

/** An in-memory stand-in for localStorage (used in tests and on the server). */
export function createMemoryStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

export function createMockAuthService(
  storage: KeyValueStorage,
  // How new ids are made. Tests can pass a predictable one.
  makeId: () => string = () => crypto.randomUUID(),
): AuthService {
  const listeners = new Set<(user: AuthUser | null) => void>();

  // Read the whole database from storage (or start empty).
  function load(): MockDatabase {
    const raw = storage.getItem(MOCK_STORAGE_KEY);
    if (!raw) return emptyDatabase();
    try {
      return JSON.parse(raw) as MockDatabase;
    } catch {
      // Corrupted data (e.g. edited by hand): start over instead of crashing.
      return emptyDatabase();
    }
  }

  function save(db: MockDatabase) {
    storage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
  }

  // Strip the password before handing a user to the rest of the app.
  function publicUser(user: MockUser): AuthUser {
    return { id: user.id, email: user.email };
  }

  function currentUser(db: MockDatabase): AuthUser | null {
    const user = db.users.find((u) => u.id === db.currentUserId);
    return user ? publicUser(user) : null;
  }

  function notify(user: AuthUser | null) {
    listeners.forEach((listener) => listener(user));
  }

  return {
    mode: "mock",

    async getCurrentUser() {
      return currentUser(load());
    },

    async signUp(email, password): Promise<SignUpResult> {
      const problem = validateCredentials(email, password);
      if (problem) throw new Error(problem);

      const db = load();
      const cleanEmail = email.trim().toLowerCase();
      if (db.users.some((u) => u.email === cleanEmail)) {
        throw new Error("An account with this email already exists. Try logging in.");
      }

      const user: MockUser = { id: makeId(), email: cleanEmail, password };
      db.users.push(user);
      db.currentUserId = user.id; // signing up also signs you in
      save(db);

      const signedIn = publicUser(user);
      notify(signedIn);
      return { user: signedIn, needsEmailConfirmation: false };
    },

    async signIn(email, password) {
      const db = load();
      const cleanEmail = email.trim().toLowerCase();
      const user = db.users.find((u) => u.email === cleanEmail && u.password === password);
      // Same message for "no such email" and "wrong password", like real apps,
      // so nobody can find out which emails have accounts.
      if (!user) throw new Error("Wrong email or password.");

      db.currentUserId = user.id;
      save(db);
      const signedIn = publicUser(user);
      notify(signedIn);
      return signedIn;
    },

    async signInWithGoogle() {
      throw new Error("Google login needs a Supabase project. See README.md.");
    },

    async signOut() {
      const db = load();
      db.currentUserId = null;
      save(db);
      notify(null);
    },

    onAuthChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async getProfileByUsername(username) {
      const wanted = normalizeUsername(username);
      return load().profiles.find((p) => p.username === wanted) ?? null;
    },

    async getProfileForUser(userId) {
      return load().profiles.find((p) => p.id === userId) ?? null;
    },

    async createProfile(input: NewProfile) {
      const db = load();
      const user = currentUser(db);
      // Mirrors the database rule (RLS): you can only create YOUR OWN profile.
      if (!user) throw new Error("You need to be logged in to pick a username.");

      const username = validateUsername(input.username);
      if (!username.ok) throw new Error(username.error);
      const displayName = validateDisplayName(input.displayName ?? "");
      if (!displayName.ok) throw new Error(displayName.error);

      if (db.profiles.some((p) => p.id === user.id)) {
        throw new Error("You already have a profile.");
      }
      if (db.profiles.some((p) => p.username === username.value)) {
        throw new Error("That username is taken. Try another one.");
      }

      const profile: Profile = {
        id: user.id,
        username: username.value,
        display_name: displayName.value || null, // "" becomes null
        avatar_url: null,
        bio: null,
      };
      db.profiles.push(profile);
      save(db);
      return profile;
    },
  };
}
