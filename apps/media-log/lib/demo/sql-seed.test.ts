// Checks supabase/seed/demo-account.sql (Stage 7) without a database.
// We can't run SQL here, but we can read the file and check that:
// 1) every media item is exactly what our search returns for it (same id,
//    title, cover, genres as the saved samples), so it never creates a
//    second copy of an item a user logs later;
// 2) every log follows the same rules as the log form (validateLogInput);
// 3) the list and the logs only use items the file caches;
// 4) the account would get bridge picks.
// The SQL file keeps one row per line so these simple patterns can read it.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAINSTREAM_TYPES, BRIDGE_MIN_MAINSTREAM_SHARE } from "../media/recommend";
import { isLogStatus, localToday, mediaItemFields, validateLogInput } from "../media/validation";
import type { MediaResult, ProgressUnit } from "../media/types";
import { convertAniListResponse } from "../sources/anilist";
import { convertIgdbResponse } from "../sources/igdb";
import { convertOpenLibraryResponse } from "../sources/openlibrary";
import aniListSample from "../sources/samples/anilist-search.json";
import igdbSample from "../sources/samples/igdb-games.json";
import openLibrarySample from "../sources/samples/openlibrary-search.json";
import tmdbMovieSample from "../sources/samples/tmdb-search-movie.json";
import tmdbTvSample from "../sources/samples/tmdb-search-tv.json";
import { convertTmdbMovieResponse, convertTmdbTvResponse } from "../sources/tmdb";

const sql = readFileSync(new URL("../../supabase/seed/demo-account.sql", import.meta.url), "utf8");
const rowLines = sql.split("\n").filter((line) => line.trimStart().startsWith("('"));

// A SQL text literal: 'It''s' (a quote inside is doubled).
const TEXT = String.raw`'((?:[^']|'')*)'`;
const unquote = (value: string) => value.replace(/''/g, "'");
const parseArray = (inside: string) => [...inside.matchAll(new RegExp(TEXT, "g"))].map((m) => unquote(m[1]));
const parseNumber = (value: string) => (value === "null" ? null : Number(value));

const ITEM_ROW = new RegExp(
  String.raw`^\s*\('(\w+)', '(\w+)', '([^']+)', ${TEXT}, (\d+|null), '([^']+)', array\[(.*?)\](?:::text\[\])?, (\d+|null), array\[(.*?)\](?:::text\[\])?\),?$`,
);
const LOG_ROW = new RegExp(
  String.raw`^\s*\('(\w+)', '(\w+)', '([^']+)', '(\w+)', (null|[\d.]+), (null|[\d.]+), (null|'\w+'), (\d+), (true|false), (null|${TEXT})\),?$`,
);
const LIST_ROW = /^\s*\('(\w+)', '(\w+)', '([^']+)', (\d+)\),?$/;

const key = (type: string, source: string, id: string) => `${source}:${type}:${id}`;

const items = rowLines.flatMap((line) => {
  const m = ITEM_ROW.exec(line);
  if (!m) return [];
  const [, type, source, sourceId, title, year, cover, creators, totalUnits, genres] = m;
  return [
    {
      type,
      source,
      source_id: sourceId,
      title: unquote(title),
      year: parseNumber(year),
      cover_url: cover,
      creators: parseArray(creators),
      total_units: parseNumber(totalUnits),
      genres: parseArray(genres),
    },
  ];
});

const logs = rowLines.flatMap((line) => {
  const m = LOG_ROW.exec(line);
  if (!m) return [];
  const [, type, source, sourceId, status, rating, progress, unit, daysAgo, rewatch, review] = m;
  return [
    {
      key: key(type, source, sourceId),
      type,
      status,
      rating: parseNumber(rating),
      progress: parseNumber(progress),
      unit: unit === "null" ? null : (unit.slice(1, -1) as ProgressUnit),
      daysAgo: Number(daysAgo),
      rewatch: rewatch === "true",
      review: review === "null" ? "" : unquote(review.slice(1, -1)),
    },
  ];
});

const listRows = rowLines.flatMap((line) => {
  const m = LIST_ROW.exec(line);
  return m ? [{ key: key(m[1], m[2], m[3]), position: Number(m[4]) }] : [];
});

// What search returns, from the saved samples.
const fromSamples: MediaResult[] = [
  ...convertTmdbMovieResponse(tmdbMovieSample),
  ...convertTmdbTvResponse(tmdbTvSample),
  ...convertAniListResponse(aniListSample),
  ...convertOpenLibraryResponse(openLibrarySample),
  ...convertIgdbResponse(igdbSample),
];
const sampleByKey = new Map(fromSamples.map((r) => [key(r.type, r.source, r.sourceId), r]));

describe("supabase/seed/demo-account.sql", () => {
  it("has one recognised row per line (nothing silently skipped)", () => {
    expect(rowLines.length).toBe(items.length + logs.length + listRows.length);
    expect(items.length).toBeGreaterThanOrEqual(15);
    expect(logs.length).toBeGreaterThanOrEqual(15);
  });

  it("caches each item exactly as search returns it", () => {
    for (const item of items) {
      const sample = sampleByKey.get(key(item.type, item.source, item.source_id));
      expect(sample, `${item.title} should be in the saved samples`).toBeDefined();
      expect(item, item.title).toEqual(mediaItemFields(sample!));
    }
  });

  it("caches each item once", () => {
    const keys = items.map((i) => key(i.type, i.source, i.source_id));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only logs and lists items it caches", () => {
    const cached = new Set(items.map((i) => key(i.type, i.source, i.source_id)));
    for (const row of [...logs, ...listRows]) expect(cached.has(row.key), row.key).toBe(true);
  });

  it("writes every log the way the log form would accept it", () => {
    const now = new Date(Date.UTC(2026, 10, 5, 12, 0));
    const today = localToday(now);
    for (const log of logs) {
      expect(isLogStatus(log.status), log.key).toBe(true);
      const finishedAt =
        log.status === "completed" ? localToday(new Date(now.getTime() - log.daysAgo * 24 * 60 * 60 * 1000)) : null;
      const checked = validateLogInput(
        {
          media: sampleByKey.get(log.key)!,
          status: log.status as never, // checked by isLogStatus just above
          rating: log.rating,
          reviewText: log.review,
          finishedAt,
          rewatch: log.rewatch,
          progress: log.progress,
          progressUnit: log.unit,
        },
        today,
      );
      expect(checked, log.key).toMatchObject({ ok: true });
    }
  });

  it("gives the account bridge picks (mostly movies, series and books)", () => {
    const mainstream = logs.filter((log) => MAINSTREAM_TYPES.includes(log.type as never)).length;
    expect(mainstream / logs.length).toBeGreaterThanOrEqual(BRIDGE_MIN_MAINSTREAM_SHARE);
    // Each item is logged once, so "items" and "logs" are the same count here.
    expect(new Set(logs.map((log) => log.key)).size).toBe(logs.length);
  });

  it("spreads finished dates over two years, for the yearly recap", () => {
    const completed = logs.filter((log) => log.status === "completed");
    expect(completed.some((log) => log.daysAgo < 300)).toBe(true);
    expect(completed.some((log) => log.daysAgo > 366)).toBe(true);
  });

  it("numbers the list 0, 1, 2... like the app", () => {
    expect(listRows.map((row) => row.position)).toEqual(listRows.map((_, i) => i));
  });

  it("contains no secrets", () => {
    // A Supabase key is a long "eyJ..." token; the service_role key must never be anywhere.
    expect(sql).not.toMatch(/eyJ[\w-]{20,}/);
    expect(sql.toLowerCase()).not.toContain("service_role");
  });
});
