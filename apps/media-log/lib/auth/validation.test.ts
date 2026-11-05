import { describe, expect, it } from "vitest";
import {
  normalizeUsername,
  suggestUsername,
  validateCredentials,
  validateDisplayName,
  validateUsername,
} from "./validation";

describe("normalizeUsername", () => {
  it("trims spaces and lowercases", () => {
    expect(normalizeUsername("  Amasten ")).toBe("amasten");
  });
});

describe("validateUsername", () => {
  it("accepts a normal username and returns it cleaned", () => {
    expect(validateUsername(" Film_Fan99 ")).toEqual({ ok: true, value: "film_fan99" });
  });

  it("accepts the shortest and longest allowed lengths", () => {
    expect(validateUsername("abc").ok).toBe(true);
    expect(validateUsername("a".repeat(20)).ok).toBe(true);
  });

  it("rejects names that are too short or too long", () => {
    expect(validateUsername("ab")).toEqual({ ok: false, error: "Username must be at least 3 characters." });
    expect(validateUsername("a".repeat(21))).toEqual({ ok: false, error: "Username must be at most 20 characters." });
  });

  it("rejects names that don't start with a letter", () => {
    expect(validateUsername("9lives").ok).toBe(false);
    expect(validateUsername("_hidden").ok).toBe(false);
  });

  it("rejects spaces, dashes, dots and accents", () => {
    for (const bad of ["film fan", "film-fan", "film.fan", "cinéphile"]) {
      expect(validateUsername(bad)).toEqual({ ok: false, error: "Use only letters, numbers and underscores (_)." });
    }
  });

  it("rejects reserved names in any case", () => {
    expect(validateUsername("Admin").ok).toBe(false);
    expect(validateUsername("settings").ok).toBe(false);
  });
});

describe("validateDisplayName", () => {
  it("allows empty (display name is optional)", () => {
    expect(validateDisplayName("   ")).toEqual({ ok: true, value: "" });
  });

  it("rejects names over 50 characters", () => {
    expect(validateDisplayName("x".repeat(51)).ok).toBe(false);
  });
});

describe("suggestUsername", () => {
  it("builds a valid username from an email", () => {
    expect(suggestUsername("Amasten.B-99@mail.com")).toBe("amasten_b_99");
  });

  it("drops leading digits so the name starts with a letter", () => {
    expect(suggestUsername("2024jo@mail.com")).toBe("jo_");
  });

  it("cuts long names to 20 characters", () => {
    expect(suggestUsername("averyveryverylongemailname@mail.com")).toHaveLength(20);
  });

  it("returns an empty string when nothing usable is left", () => {
    expect(suggestUsername("1234@mail.com")).toBe("");
  });

  it("always suggests something validateUsername accepts (when not empty)", () => {
    for (const email of ["a@b.co", "Jean-Luc.Picard@starfleet.org", "x__y@z.com"]) {
      expect(validateUsername(suggestUsername(email)).ok).toBe(true);
    }
  });
});

describe("validateCredentials", () => {
  it("returns null when email and password look fine", () => {
    expect(validateCredentials("me@example.com", "secret1")).toBeNull();
  });

  it("catches a bad email", () => {
    expect(validateCredentials("me@example", "secret1")).toBe("Please enter a valid email address.");
  });

  it("catches a short password", () => {
    expect(validateCredentials("me@example.com", "12345")).toBe("Password must be at least 6 characters.");
  });
});
