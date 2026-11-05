import { describe, expect, it } from "vitest";
import { applyPatch, definedOnly, diffCheckin, emptyFields, fieldsOf, mergePatches } from "./merge";
import type { Checkin } from "./types";

const info = { id: "c-1", userId: "user-1", date: "2026-11-05", now: "2026-11-05T15:00:00.000Z" };

describe("definedOnly", () => {
  it("drops 'not touched' (undefined) but keeps 'cleared' (null)", () => {
    expect(definedOnly({ mood: undefined, journal_text: null, screen_time_minutes: 30 })).toEqual({
      journal_text: null,
      screen_time_minutes: 30,
    });
  });
});

describe("mergePatches", () => {
  it("combines two partial saves, newer values winning", () => {
    expect(mergePatches({ mood: 2, journal_text: "first" }, { mood: 4 })).toEqual({ mood: 4, journal_text: "first" });
  });

  it("doesn't let a missing field wipe an older value", () => {
    expect(mergePatches({ mood: 2 }, { mood: undefined, screen_time_minutes: 60 })).toEqual({
      mood: 2,
      screen_time_minutes: 60,
    });
  });

  it("lets null clear an older value", () => {
    expect(mergePatches({ mood: 2 }, { mood: null })).toEqual({ mood: null });
  });

  it("works with nothing waiting before", () => {
    expect(mergePatches(undefined, { mood: 3 })).toEqual({ mood: 3 });
  });
});

describe("applyPatch", () => {
  it("makes a new day's check-in from the first partial save (the rest stays empty)", () => {
    expect(applyPatch(null, { mood: 4 }, info)).toEqual({
      id: "c-1",
      user_id: "user-1",
      date: "2026-11-05",
      ...emptyFields(),
      mood: 4,
      created_at: info.now,
      updated_at: info.now,
    });
  });

  it("only changes the patched fields of an existing check-in", () => {
    const first = applyPatch(null, { mood: 4, gratitude: ["tea"] }, info);
    const later = applyPatch(first, { journal_text: "Calm day" }, { ...info, now: "2026-11-05T20:00:00.000Z" });
    expect(later.mood).toBe(4);
    expect(later.gratitude).toEqual(["tea", "", ""]);
    expect(later.journal_text).toBe("Calm day");
    expect(later.created_at).toBe(info.now); // still the first save
    expect(later.updated_at).toBe("2026-11-05T20:00:00.000Z");
  });

  it("cleans what it applies", () => {
    expect(applyPatch(null, { journal_text: "   " }, info).journal_text).toBeNull();
  });
});

describe("fieldsOf", () => {
  it("gives empty answers when there's no check-in yet", () => {
    expect(fieldsOf(null)).toEqual({
      mood: null,
      mood_tags: [],
      screen_time_minutes: null,
      gratitude: ["", "", ""],
      journal_text: null,
    });
  });

  it("repairs rows from the database (null arrays, fewer than 3 gratitudes)", () => {
    const row = { mood: 3, mood_tags: null, screen_time_minutes: 10, gratitude: [], journal_text: null } as unknown as Checkin;
    expect(fieldsOf(row)).toEqual({
      mood: 3,
      mood_tags: [],
      screen_time_minutes: 10,
      gratitude: ["", "", ""],
      journal_text: null,
    });
  });
});

describe("diffCheckin (what to save next)", () => {
  it("returns null when nothing changed", () => {
    expect(diffCheckin(emptyFields(), emptyFields())).toBeNull();
  });

  it("returns only the changed fields", () => {
    const saved = { ...emptyFields(), mood: 3 };
    const draft = { ...saved, screen_time_minutes: 90, gratitude: ["sun", "", ""] };
    expect(diffCheckin(saved, draft)).toEqual({ screen_time_minutes: 90, gratitude: ["sun", "", ""] });
  });

  it("ignores spaces you're still typing (no endless re-saving)", () => {
    const saved = { ...emptyFields(), journal_text: "hello" };
    expect(diffCheckin(saved, { ...saved, journal_text: "hello " })).toBeNull();
  });

  it("notices a cleared answer", () => {
    const saved = { ...emptyFields(), mood: 3 };
    expect(diffCheckin(saved, { ...saved, mood: null })).toEqual({ mood: null });
  });

  it("compares lists item by item", () => {
    const saved = { ...emptyFields(), mood_tags: ["calm"] };
    expect(diffCheckin(saved, { ...saved, mood_tags: ["calm"] })).toBeNull();
    expect(diffCheckin(saved, { ...saved, mood_tags: ["calm", "tired"] })).toEqual({ mood_tags: ["calm", "tired"] });
  });
});
