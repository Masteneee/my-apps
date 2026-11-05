import { describe, expect, it } from "vitest";
import { OfflineError } from "../checkin/types";
import { friendlyFriendsError, toFriendsError } from "./supabase";

describe("toFriendsError", () => {
  it("is null when the request worked", () => {
    expect(toFriendsError({ error: null, status: 200 }, "friendship")).toBeNull();
  });

  it("says you're offline when the request never got an answer (status 0)", () => {
    const error = toFriendsError({ error: { message: "Failed to fetch" }, status: 0 }, "friendship");
    expect(error).toBeInstanceOf(OfflineError);
    expect(error?.message).toContain("need the internet");
  });
});

describe("friendlyFriendsError", () => {
  it("explains a duplicate for each table", () => {
    expect(friendlyFriendsError({ code: "23505", message: "dup" }, "friendship")).toContain("already");
    expect(friendlyFriendsError({ code: "23505", message: "dup" }, "shared streak")).toContain("already share");
  });

  it("explains RLS refusals, missing rows and unknown codes", () => {
    expect(friendlyFriendsError({ code: "42501", message: "rls" }, "shared streak")).toContain("with a friend");
    expect(friendlyFriendsError({ code: "PGRST116", message: "0 rows" }, "friendship")).toContain("doesn't exist");
    expect(friendlyFriendsError({ code: "XX000", message: "Original text" }, "friendship")).toBe("Original text");
  });
});
