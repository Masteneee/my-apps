import { describe, expect, it } from "vitest";
import type { Checkin, Habit, HabitEntry } from "./checkin/types";
import {
  buildExport,
  csvField,
  csvRow,
  CSV_BASE_COLUMNS,
  EXPORT_FORMAT_VERSION,
  exportFileName,
  exportToCsv,
  exportToJson,
  habitColumnNames,
  type ExportInput,
} from "./export";

const ME = "me";

function habit(overrides: Partial<Habit>): Habit {
  return {
    id: "h",
    user_id: ME,
    name: "Habit",
    icon: null,
    type: "checkbox",
    target: null,
    is_archived: false,
    created_at: "2026-10-01T12:00:00.000Z",
    ...overrides,
  };
}

function checkin(date: string, overrides: Partial<Checkin> = {}): Checkin {
  return {
    id: `c-${date}`,
    user_id: ME,
    date,
    mood: null,
    mood_tags: [],
    screen_time_minutes: null,
    gratitude: ["", "", ""],
    journal_text: null,
    created_at: `${date}T20:00:00.000Z`,
    updated_at: `${date}T20:00:00.000Z`,
    ...overrides,
  };
}

const entry = (habit_id: string, date: string, value: number, user_id = ME): HabitEntry => ({ habit_id, user_id, date, value });

const stretch = habit({ id: "stretch", name: "Stretch" });
const water = habit({ id: "water", name: "Water", type: "number", target: 8, created_at: "2026-10-02T12:00:00.000Z" });

function input(overrides: Partial<ExportInput> = {}): ExportInput {
  return {
    account: { id: ME, email: "me@example.com", username: "me", display_name: "Me" },
    habits: [water, stretch],
    checkins: [
      checkin("2026-11-05", {
        mood: 4,
        mood_tags: ["calm", "tired"],
        screen_time_minutes: 135,
        gratitude: ["tea", "", "my sister"],
        journal_text: 'Long day, but "good".\nWalked home.',
      }),
      checkin("2026-11-03", { mood: 2 }),
    ],
    habitEntries: [entry("stretch", "2026-11-05", 1), entry("water", "2026-11-05", 6), entry("water", "2026-11-04", 8)],
    exportedAt: new Date("2026-11-06T02:30:00.000Z"),
    timeZone: "America/Toronto",
    ...overrides,
  };
}

describe("buildExport", () => {
  it("puts everything in a fixed order, with when and in which time zone", () => {
    const data = buildExport(input());
    expect(data).toMatchObject({
      app: "Wellbeing",
      format_version: EXPORT_FORMAT_VERSION,
      exported_at: "2026-11-06T02:30:00.000Z",
      time_zone: "America/Toronto",
      account: { email: "me@example.com", username: "me" },
    });
    expect(data.habits.map((h) => h.name)).toEqual(["Stretch", "Water"]); // oldest first
    expect(data.checkins.map((c) => c.date)).toEqual(["2026-11-03", "2026-11-05"]);
    expect(data.habit_entries.map((e) => `${e.date} ${e.habit_id}`)).toEqual([
      "2026-11-04 water",
      "2026-11-05 stretch",
      "2026-11-05 water",
    ]);
    expect(data.not_included).toContain("Friends");
  });

  it("includes your journal (it's yours)", () => {
    expect(exportToJson(buildExport(input()))).toContain("Walked home.");
  });

  it("drops any row that isn't yours (a safety net)", () => {
    const data = buildExport(
      input({
        habits: [stretch, habit({ id: "theirs", user_id: "friend", name: "Their habit" })],
        checkins: [checkin("2026-11-05", { user_id: "friend", journal_text: "their secret" })],
        habitEntries: [entry("theirs", "2026-11-05", 1, "friend")],
      }),
    );
    expect(data.habits.map((h) => h.id)).toEqual(["stretch"]);
    expect(data.checkins).toEqual([]);
    expect(data.habit_entries).toEqual([]);
    expect(exportToJson(data)).not.toContain("their secret");
  });

  it("doesn't change the lists it was given", () => {
    const habits = [water, stretch];
    buildExport(input({ habits }));
    expect(habits.map((h) => h.id)).toEqual(["water", "stretch"]);
  });
});

describe("exportToJson", () => {
  it("can be read back exactly", () => {
    const data = buildExport(input());
    expect(JSON.parse(exportToJson(data))).toEqual(data);
  });
});

describe("csvField and csvRow", () => {
  it("leaves simple text alone and empties null", () => {
    expect(csvField("tea")).toBe("tea");
    expect(csvField(42)).toBe("42");
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
  });

  it("quotes text with commas, quotes or new lines, and doubles the quotes", () => {
    expect(csvField("tea, cake")).toBe('"tea, cake"');
    expect(csvField('I said "hi"')).toBe('"I said ""hi"""');
    expect(csvField("line 1\nline 2")).toBe('"line 1\nline 2"');
    expect(csvField("a\r\nb")).toBe('"a\r\nb"');
  });

  it("joins cells with commas", () => {
    expect(csvRow(["a", null, 3, "b,c"])).toBe('a,,3,"b,c"');
  });
});

describe("habitColumnNames", () => {
  it("marks archived habits and numbers repeated names", () => {
    expect(
      habitColumnNames([
        { name: "Read", is_archived: true },
        { name: "Read", is_archived: false },
        { name: "Read", is_archived: false },
        { name: "Water", is_archived: false },
      ]),
    ).toEqual(["Read (archived)", "Read", "Read (2)", "Water"]);
  });
});

describe("exportToCsv", () => {
  const csv = exportToCsv(buildExport(input()));
  const lines = csv.slice(1).split("\r\n"); // slice(1): skip the BOM

  it("starts with a BOM so Excel reads accents and emoji right, and ends lines with \\r\\n", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("has the answer columns, then one column per habit", () => {
    expect(lines[0]).toBe([...CSV_BASE_COLUMNS, "Stretch", "Water"].join(","));
  });

  it("has one row per day with a check-in OR a habit entry, oldest first", () => {
    expect(lines.slice(1, -1).map((line) => line.slice(0, 10))).toEqual(["2026-11-03", "2026-11-04", "2026-11-05"]);
    expect(lines.at(-1)).toBe(""); // the final \r\n
  });

  it("fills a day's answers, keeping the journal's quotes and line break safe", () => {
    const nov5 = csv.slice(csv.indexOf("2026-11-05"));
    expect(nov5).toBe(
      '2026-11-05,4,Good,calm; tired,135,tea,,my sister,"Long day, but ""good"".\nWalked home.",yes,6\r\n',
    );
  });

  it("leaves empty cells for skipped answers and habits not done", () => {
    expect(lines[1]).toBe("2026-11-03,2,Low,,,,,,,,");
    expect(lines[2]).toBe("2026-11-04,,,,,,,,,,8"); // only Water that day
  });

  it("is just the header when there's no data yet", () => {
    const empty = exportToCsv(buildExport(input({ habits: [], checkins: [], habitEntries: [] })));
    expect(empty).toBe("﻿" + CSV_BASE_COLUMNS.join(",") + "\r\n");
  });
});

describe("exportFileName", () => {
  it("has the day in it", () => {
    expect(exportFileName("2026-11-05", "csv")).toBe("wellbeing-export-2026-11-05.csv");
  });
});
