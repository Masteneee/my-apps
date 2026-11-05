import { describe, expect, it } from "vitest";
import { fetchAllPages, friendlyCheckinError, PAGE_SIZE, rowToCheckin, toStoreError } from "./supabase";
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

describe("fetchAllPages (Stage 3: long lists come in pages)", () => {
  // A fake database with `total` numbered rows that answers like Supabase's .range().
  function fakeTable(total: number) {
    const asked: [number, number][] = [];
    const rows = Array.from({ length: total }, (_, i) => i);
    const fetchPage = async (first: number, last: number) => {
      asked.push([first, last]);
      return { data: rows.slice(first, last + 1), error: null, status: 200 };
    };
    return { asked, fetchPage };
  }

  it("joins all the pages, in order, and stops at the first page that isn't full", async () => {
    const table = fakeTable(25);
    const rows = await fetchAllPages(table.fetchPage, 10);
    expect(rows).toEqual(Array.from({ length: 25 }, (_, i) => i));
    expect(table.asked).toEqual([
      [0, 9],
      [10, 19],
      [20, 29],
    ]);
  });

  it("asks one more (empty) page when the last one is exactly full", async () => {
    const table = fakeTable(20);
    expect(await fetchAllPages(table.fetchPage, 10)).toHaveLength(20);
    expect(table.asked).toHaveLength(3);
  });

  it("returns nothing for an empty table, and uses pages of 1000 by default", async () => {
    const table = fakeTable(0);
    expect(await fetchAllPages(table.fetchPage)).toEqual([]);
    expect(PAGE_SIZE).toBe(1000);
    expect(table.asked).toEqual([[0, 999]]);
  });

  it("throws an OfflineError when the network is down (so the app can say so)", async () => {
    const fetchPage = async () => ({ data: null, error: { message: "Failed to fetch" }, status: 0 });
    await expect(fetchAllPages(fetchPage)).rejects.toBeInstanceOf(OfflineError);
  });

  it("throws a friendly error when the database refuses", async () => {
    const fetchPage = async () => ({ data: null, error: { code: "42501", message: "rls" }, status: 403 });
    await expect(fetchAllPages(fetchPage)).rejects.toThrow("your own");
  });
});
