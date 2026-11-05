// Guards for the Stage 4 SQL file (friends + shared streaks). Like
// lib/checkin/migration.test.ts, we can't run Postgres in a test, but we can
// read the file and check the privacy rules that matter most stay true:
// friends never get the check-in (journal), never get whole habit entries,
// and only see "who did the shared habit on which day".

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname, "..", "..", "supabase", "migrations");
// Ignore comments, so a comment can't make a test pass (or fail) by accident.
const stripComments = (text: string) => text.replace(/--.*$/gm, "");
const sql = stripComments(readFileSync(join(dir, "20261105120000_friends_shared_streaks.sql"), "utf8"));

const policies = [...sql.matchAll(/create policy "([^"]+)"\s+on public\.(\w+)([\s\S]*?);/g)].map((m) => ({
  name: m[1],
  table: m[2],
  body: m[3],
}));

// The function's body, between the two $$.
const functionBody = /create or replace function public\.shared_streak_days[\s\S]*?\$\$([\s\S]*?)\$\$/.exec(sql)?.[1] ?? "";

describe("Stage 4 migration", () => {
  it("creates both tables with Row Level Security on", () => {
    for (const table of ["friendships", "shared_streaks"]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("adds NO policy to checkins or habit_entries, in any migration but Stage 2's owner-only ones", () => {
    expect(policies.every((p) => p.table === "friendships" || p.table === "shared_streaks")).toBe(true);
    // And no later migration file sneaks one in either.
    for (const file of readdirSync(dir).filter((f) => f > "20261105110000_checkins_habits.sql")) {
      const later = stripComments(readFileSync(join(dir, file), "utf8"));
      expect(later, file).not.toMatch(/create policy "[^"]+"\s+on public\.(checkins|habit_entries)/);
      expect(later, file).not.toMatch(/grant [^;]* on [^;]*\b(checkins|habit_entries)\b/);
    }
  });

  it("only lets the two people in a friendship or shared streak see or end it", () => {
    const readOrEnd = policies.filter((p) => /for (select|delete)/.test(p.body));
    expect(readOrEnd).toHaveLength(4); // read + delete, on both tables
    for (const policy of readOrEnd) {
      expect(policy.body, policy.name).toContain("using ((select auth.uid()) in (user_a, user_b))");
    }
  });

  it("only lets the person who was asked accept, and only the status (and habit) can change", () => {
    const updates = policies.filter((p) => /for update/.test(p.body));
    expect(updates).toHaveLength(2);
    for (const policy of updates) expect(policy.body).toContain("(select auth.uid()) = user_b");
    expect(sql).toContain("grant update (status) on public.friendships to authenticated");
    expect(sql).toContain("grant update (status, habit_b) on public.shared_streaks to authenticated");
    expect(sql).not.toMatch(/grant update on/); // never a whole-table update
  });

  it("new requests and invites always start as pending", () => {
    const inserts = policies.filter((p) => /for insert/.test(p.body));
    expect(inserts).toHaveLength(2);
    for (const policy of inserts) {
      expect(policy.body).toContain("(select auth.uid()) = user_a");
      expect(policy.body).toContain("status = 'pending'");
    }
  });

  it("allows one friendship per pair and only shares your own habits", () => {
    expect(sql).toMatch(/on public\.friendships \(least\(user_a, user_b\), greatest\(user_a, user_b\)\)/);
    expect(sql).toContain("foreign key (habit_a, user_a) references public.habits (id, user_id)");
    expect(sql).toContain("foreign key (habit_b, user_b) references public.habits (id, user_id)");
    expect(sql).toMatch(/foreign key \(friendship_id\) references public\.friendships \(id\) on delete cascade/);
  });

  it("stores no copy of the counts (they're computed from both people's days)", () => {
    expect(sql).not.toMatch(/current_count|best_count|last_both_date/);
  });

  it("the shared_streak_days function returns only (who, which day), never check-in data", () => {
    expect(sql).toMatch(/returns table \(user_id uuid, day date\)/);
    // Exactly these two columns come out. (e.value is only compared inside, never returned.)
    expect(functionBody).toMatch(/^\s*select e\.user_id, e\.date as day\s+from/);
    expect(functionBody).not.toMatch(/checkins|journal|mood|gratitude|screen_time/);
  });

  it("the function checks you're in an active shared streak with an accepted friend", () => {
    expect(functionBody).toContain("(select auth.uid()) in (s.user_a, s.user_b)");
    expect(functionBody).toContain("s.status = 'active'");
    expect(functionBody).toContain("f.status = 'accepted'");
    expect(functionBody).toContain("e.value >= coalesce(h.target, 1)"); // same "done" rule as isHabitDone
  });

  it("the function is a safe security definer: fixed search_path, only for logged-in users", () => {
    expect(sql).toMatch(/security definer\s+set search_path = ''/);
    expect(sql).toContain("revoke execute on function public.shared_streak_days(uuid, date, date) from public, anon");
    expect(sql).toContain("grant execute on function public.shared_streak_days(uuid, date, date) to authenticated");
  });

  it("gives logged-out visitors nothing", () => {
    expect(sql).toContain("revoke all on public.friendships, public.shared_streaks from anon, authenticated");
    expect(sql).not.toMatch(/grant [^;]* to anon/);
  });
});
