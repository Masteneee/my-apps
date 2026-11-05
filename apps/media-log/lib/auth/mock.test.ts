import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryStorage, createMockAuthService, MOCK_STORAGE_KEY, type KeyValueStorage } from "./mock";
import type { AuthService } from "./types";

// Predictable ids ("user-1", "user-2", ...) make the expectations easy to read.
function idMaker() {
  let n = 0;
  return () => `user-${++n}`;
}

let storage: KeyValueStorage;
let auth: AuthService;

// A fresh, empty "browser" before every test, so tests can't affect each other.
beforeEach(() => {
  storage = createMemoryStorage();
  auth = createMockAuthService(storage, idMaker());
});

describe("mock auth: accounts", () => {
  it("starts signed out", async () => {
    expect(await auth.getCurrentUser()).toBeNull();
  });

  it("sign up creates an account and signs you in", async () => {
    const result = await auth.signUp("Me@Example.com", "secret1");
    expect(result).toEqual({ user: { id: "user-1", email: "me@example.com" }, needsEmailConfirmation: false });
    expect(await auth.getCurrentUser()).toEqual({ id: "user-1", email: "me@example.com" });
  });

  it("never hands the password to the app", async () => {
    const { user } = await auth.signUp("me@example.com", "secret1");
    expect(user).not.toHaveProperty("password");
  });

  it("refuses a second account with the same email (any case)", async () => {
    await auth.signUp("me@example.com", "secret1");
    await expect(auth.signUp("ME@example.com", "other12")).rejects.toThrow("already exists");
  });

  it("refuses bad credentials before saving anything", async () => {
    await expect(auth.signUp("not-an-email", "secret1")).rejects.toThrow("valid email");
    await expect(auth.signUp("me@example.com", "123")).rejects.toThrow("at least 6");
    expect(storage.getItem(MOCK_STORAGE_KEY)).toBeNull();
  });

  it("signs out and back in", async () => {
    await auth.signUp("me@example.com", "secret1");
    await auth.signOut();
    expect(await auth.getCurrentUser()).toBeNull();

    const user = await auth.signIn("me@example.com", "secret1");
    expect(user.id).toBe("user-1");
    expect(await auth.getCurrentUser()).toEqual(user);
  });

  it("rejects a wrong password with a vague message", async () => {
    await auth.signUp("me@example.com", "secret1");
    await auth.signOut();
    await expect(auth.signIn("me@example.com", "nope123")).rejects.toThrow("Wrong email or password.");
    await expect(auth.signIn("nobody@example.com", "secret1")).rejects.toThrow("Wrong email or password.");
  });

  it("tells listeners about sign in and sign out, until they unsubscribe", async () => {
    const seen: (string | null)[] = [];
    const stop = auth.onAuthChange((user) => seen.push(user?.email ?? null));

    await auth.signUp("me@example.com", "secret1");
    await auth.signOut();
    stop();
    await auth.signIn("me@example.com", "secret1");

    expect(seen).toEqual(["me@example.com", null]);
  });

  it("has no Google login", async () => {
    await expect(auth.signInWithGoogle()).rejects.toThrow("Supabase");
  });
});

describe("mock auth: profiles", () => {
  it("needs you to be signed in to create a profile", async () => {
    await expect(auth.createProfile({ username: "filmfan" })).rejects.toThrow("logged in");
  });

  it("creates a profile with a cleaned username and finds it again", async () => {
    await auth.signUp("me@example.com", "secret1");
    const profile = await auth.createProfile({ username: " FilmFan ", displayName: "  Amasten " });

    expect(profile).toEqual({
      id: "user-1",
      username: "filmfan",
      display_name: "Amasten",
      avatar_url: null,
      bio: null,
    });
    expect(await auth.getProfileByUsername("FILMFAN")).toEqual(profile);
    expect(await auth.getProfileForUser("user-1")).toEqual(profile);
  });

  it("stores an empty display name as null", async () => {
    await auth.signUp("me@example.com", "secret1");
    const profile = await auth.createProfile({ username: "filmfan", displayName: "   " });
    expect(profile.display_name).toBeNull();
  });

  it("lists profiles newest first, up to a limit (Stage 5: people to follow)", async () => {
    expect(await auth.listProfiles()).toEqual([]);
    for (const name of ["first", "second", "third"]) {
      await auth.signUp(`${name}@example.com`, "secret1");
      await auth.createProfile({ username: name });
    }
    expect((await auth.listProfiles()).map((p) => p.username)).toEqual(["third", "second", "first"]);
    expect((await auth.listProfiles(2)).map((p) => p.username)).toEqual(["third", "second"]);
  });

  it("returns null for a username nobody has", async () => {
    expect(await auth.getProfileByUsername("ghost")).toBeNull();
  });

  it("rejects an invalid username", async () => {
    await auth.signUp("me@example.com", "secret1");
    await expect(auth.createProfile({ username: "no spaces" })).rejects.toThrow("letters, numbers");
  });

  it("rejects a username someone else already has (any case)", async () => {
    await auth.signUp("a@example.com", "secret1");
    await auth.createProfile({ username: "filmfan" });
    await auth.signUp("b@example.com", "secret1");
    await expect(auth.createProfile({ username: "FilmFan" })).rejects.toThrow("taken");
  });

  it("only allows one profile per account", async () => {
    await auth.signUp("me@example.com", "secret1");
    await auth.createProfile({ username: "filmfan" });
    await expect(auth.createProfile({ username: "otherfan" })).rejects.toThrow("already have a profile");
  });
});

describe("mock auth: storage", () => {
  it("keeps data after a page reload (a new service on the same storage)", async () => {
    await auth.signUp("me@example.com", "secret1");
    await auth.createProfile({ username: "filmfan" });

    const afterReload = createMockAuthService(storage, idMaker());
    expect(await afterReload.getCurrentUser()).toEqual({ id: "user-1", email: "me@example.com" });
    expect((await afterReload.getProfileByUsername("filmfan"))?.id).toBe("user-1");
  });

  it("starts fresh instead of crashing if the saved data is broken", async () => {
    storage.setItem(MOCK_STORAGE_KEY, "{not json");
    expect(await auth.getCurrentUser()).toBeNull();
    await auth.signUp("me@example.com", "secret1");
    expect(await auth.getCurrentUser()).not.toBeNull();
  });
});
