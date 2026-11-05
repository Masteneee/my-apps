import { describe, expect, it } from "vitest";
import { friendlyCheckinError, rowToCheckin, toStoreError } from "./supabase";
import { OfflineError, type Checkin } from "./types";

describe("toStoreError", () => {
  it("is null when the request worked", () => {
    expect(toStoreError({ error: null, status: 200 })).toBeNull();
  });

  it("turns a network failure (status 0) into an OfflineError, so it gets queued", () => {
    const error = toStoreError({ error: { code: "", message: "TypeError: Failed to fetch" }, status: 0 });
    expect(error).toBeInstanceOf(OfflineError);
  });

  it("turns database errors into friendly messages (not queued)", () => {
    const error = toStoreError({ error: { code: "23505", message: "duplicate key" }, status: 409 });
    expect(error).not.toBeInstanceOf(OfflineError);
    expect(error?.message).toContain("already have a habit");
  });
});

describe("friendlyCheckinError", () => {
  it("explains RLS refusals and unknown codes", () => {
    expect(friendlyCheckinError({ code: "42501", message: "new row violates row-level security" })).toContain(
      "your own",
    );
    expect(friendlyCheckinError({ code: "XX000", message: "Original text" })).toBe("Original text");
  });
});

describe("rowToCheckin", () => {
  it("repairs a database row so the app can rely on it", () => {
    const row = {
      id: "c1",
      user_id: "u1",
      date: "2026-11-05",
      mood: 4,
      mood_tags: null,
      screen_time_minutes: null,
      gratitude: ["tea"],
      journal_text: null,
      created_at: "t",
      updated_at: "t",
    } as unknown as Checkin;
    expect(rowToCheckin(row)).toMatchObject({ mood_tags: [], gratitude: ["tea", "", ""], date: "2026-11-05" });
  });
});
