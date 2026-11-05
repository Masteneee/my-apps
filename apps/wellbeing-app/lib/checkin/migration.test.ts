// Guards for the Stage 2 SQL file. We can't run Postgres in a test, but we can
// read the file and check the rules that matter most stay true, especially:
// the journal (checkins table) is readable by its owner ONLY.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GRATITUDE_MAX, HABIT_ICON_MAX, HABIT_NAME_MAX, JOURNAL_MAX, SCREEN_TIME_MAX } from "./validation";

const sql = readFileSync(
  join(__dirname, "..", "..", "supabase", "migrations", "20261105110000_checkins_habits.sql"),
  "utf8",
)
  // Ignore comments, so a comment can't make a test pass by accident.
  .replace(/--.*$/gm, "");

// Each "create policy ... ;" statement, with the table it's on.
const policies = [...sql.matchAll(/create policy "([^"]+)"\s+on public\.(\w+)([\s\S]*?);/g)].map((m) => ({
  name: m[1],
  table: m[2],
  body: m[3],
}));

describe("Stage 2 migration", () => {
  it("creates the three tables and turns on Row Level Security for each", () => {
    for (const table of ["habits", "checkins", "habit_entries"]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("allows only one check-in per person per day", () => {
    expect(sql).toMatch(/unique \(user_id, date\)/);
  });

  it("keeps check-ins (and so the journal) owner-only: every policy checks auth.uid() = user_id", () => {
    const checkinPolicies = policies.filter((p) => p.table === "checkins");
    expect(checkinPolicies.length).toBe(4); // select, insert, update, delete
    for (const policy of checkinPolicies) {
      expect(policy.body).toContain("to authenticated");
      // Every condition ("using (...)" or "with check (...)") is exactly "the row is mine".
      const conditions = policy.body.match(/(?:using|with check) \(/g) ?? [];
      const ownerOnly = policy.body.match(/(?:using|with check) \(\(select auth\.uid\(\)\) = user_id\)/g) ?? [];
      expect(conditions.length).toBeGreaterThan(0);
      expect(ownerOnly.length).toBe(conditions.length);
      expect(policy.body).not.toMatch(/friend|\bor\b/i);
    }
  });

  it("gives logged-out visitors no access at all", () => {
    expect(sql).toMatch(/revoke all on public\.habits, public\.checkins, public\.habit_entries from anon/);
    expect(sql).not.toMatch(/grant [^;]* to anon/);
  });

  it("only lets you log entries for your own habits (composite foreign key)", () => {
    expect(sql).toMatch(/foreign key \(habit_id, user_id\) references public\.habits \(id, user_id\)/);
  });

  it("uses the same limits as lib/checkin/validation.ts", () => {
    expect(sql).toContain(`char_length(journal_text) <= ${JOURNAL_MAX}`);
    expect(sql).toContain(`coalesce(char_length(gratitude[3]), 0) <= ${GRATITUDE_MAX}`);
    expect(sql).toContain(`screen_time_minutes between 0 and ${SCREEN_TIME_MAX}`);
    expect(sql).toContain(`char_length(btrim(name)) between 1 and ${HABIT_NAME_MAX}`);
    expect(sql).toContain(`char_length(icon) <= ${HABIT_ICON_MAX}`);
    expect(sql).toContain("mood between 1 and 5");
  });
});
