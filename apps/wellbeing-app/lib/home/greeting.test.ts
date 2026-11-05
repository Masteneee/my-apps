import { describe, expect, it } from "vitest";
import { greetingFor, nameToShow } from "./greeting";

describe("greetingFor", () => {
  it("says good morning from 5 am to just before noon", () => {
    expect(greetingFor(5)).toBe("Good morning");
    expect(greetingFor(11)).toBe("Good morning");
  });

  it("says good afternoon from noon to just before 6 pm", () => {
    expect(greetingFor(12)).toBe("Good afternoon");
    expect(greetingFor(17)).toBe("Good afternoon");
  });

  it("says good evening from 6 pm, and in the middle of the night", () => {
    expect(greetingFor(18)).toBe("Good evening");
    expect(greetingFor(23)).toBe("Good evening");
    expect(greetingFor(0)).toBe("Good evening");
    expect(greetingFor(4)).toBe("Good evening");
  });
});

describe("nameToShow", () => {
  it("prefers the display name", () => {
    expect(nameToShow({ username: "ana", display_name: "Ana B." })).toBe("Ana B.");
  });

  it("falls back to the username when the display name is empty", () => {
    expect(nameToShow({ username: "ana", display_name: null })).toBe("ana");
    expect(nameToShow({ username: "ana", display_name: "   " })).toBe("ana");
  });
});
