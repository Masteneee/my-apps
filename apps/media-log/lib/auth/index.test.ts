import { describe, expect, it } from "vitest";
import { pickAuthMode } from "./index";
import { friendlySupabaseError } from "./supabase";

describe("pickAuthMode", () => {
  it("uses Supabase only when both values are set", () => {
    expect(pickAuthMode("https://abc.supabase.co", "public-anon-key")).toBe("supabase");
  });

  it("falls back to the mock when a value is missing or blank", () => {
    expect(pickAuthMode(undefined, undefined)).toBe("mock");
    expect(pickAuthMode("https://abc.supabase.co", undefined)).toBe("mock");
    expect(pickAuthMode("", "public-anon-key")).toBe("mock");
    expect(pickAuthMode("   ", "   ")).toBe("mock");
  });
});

describe("friendlySupabaseError", () => {
  it("explains known error codes in plain words", () => {
    expect(friendlySupabaseError({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe(
      "Wrong email or password.",
    );
    expect(friendlySupabaseError({ code: "23505", message: "duplicate key value" })).toContain("taken");
  });

  it("falls back to Supabase's own message for unknown codes", () => {
    expect(friendlySupabaseError({ code: "something_new", message: "Original text" })).toBe("Original text");
  });
});
