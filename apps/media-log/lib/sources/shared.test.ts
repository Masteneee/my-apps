import { describe, expect, it, vi } from "vitest";
import {
  cleanCoverUrl,
  cleanGenres,
  GENRES_MAX,
  cleanTotalUnits,
  cleanYear,
  fetchJson,
  matchesQuery,
  normalizeText,
  SourceError,
  stripHtml,
  uniqueNames,
  yearFromDate,
} from "./shared";

describe("text helpers", () => {
  it("normalizes case, accents and punctuation", () => {
    expect(normalizeText("Amélie!")).toBe("amelie");
    expect(normalizeText("Frieren: Beyond Journey’s End")).toBe(normalizeText("frieren beyond journey's end"));
    expect(normalizeText(null)).toBe("");
  });

  it("matches a query against several titles", () => {
    expect(matchesQuery("titan", ["Shingeki no Kyojin", "Attack on Titan"])).toBe(true);
    expect(matchesQuery("titan", [null, undefined, "Dune"])).toBe(false);
    expect(matchesQuery("   ", ["Anything"])).toBe(false);
  });

  it("removes HTML from descriptions", () => {
    expect(stripHtml("<i>Hi</i><br>there &amp; <b>you</b>")).toBe("Hi there & you");
    expect(stripHtml("<br><br>")).toBeNull();
    expect(stripHtml(null)).toBeNull();
  });

  it("keeps unique, non-empty names up to a maximum", () => {
    expect(uniqueNames(["A", " ", "A", null, "B", "C"], 2)).toEqual(["A", "B"]);
  });
});

describe("number helpers (they follow the database's rules)", () => {
  it("keeps years between 1800 and 2200", () => {
    expect(cleanYear(1965)).toBe(1965);
    expect(cleanYear(1605)).toBeNull();
    expect(cleanYear(2014.5)).toBeNull();
    expect(cleanYear("2014")).toBeNull();
    expect(yearFromDate("1994-09-23")).toBe(1994);
    expect(yearFromDate("")).toBeNull();
    expect(yearFromDate("soon")).toBeNull();
  });

  it("keeps counts above 0", () => {
    expect(cleanTotalUnits(24)).toBe(24);
    expect(cleanTotalUnits(0)).toBeNull();
    expect(cleanTotalUnits(null)).toBeNull();
  });

  it("only keeps https images", () => {
    expect(cleanCoverUrl("https://a/b.jpg")).toBe("https://a/b.jpg");
    expect(cleanCoverUrl("http://a/b.jpg")).toBeNull();
    expect(cleanCoverUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("cleanGenres (Stage 6)", () => {
  it("trims, drops blanks and non-text, and repeats in any case", () => {
    expect(cleanGenres([" Drama ", "", null, 7, "drama", "Sci-Fi"])).toEqual(["Drama", "Sci-Fi"]);
  });

  it("keeps at most GENRES_MAX, each at most 100 characters", () => {
    const many = Array.from({ length: 20 }, (_, i) => `Genre ${i}`);
    expect(cleanGenres(many)).toHaveLength(GENRES_MAX);
    expect(cleanGenres(["x".repeat(150)])[0]).toHaveLength(100);
  });
});

describe("fetchJson (fake fetch)", () => {
  const options = { label: "Example", keyHint: "EXAMPLE_KEY" };
  const answering = (status: number, body = "{}") =>
    vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;

  it("returns the JSON answer", async () => {
    expect(await fetchJson(answering(200, '{"ok":1}'), "https://x", {}, options)).toEqual({ ok: 1 });
  });

  it("turns each kind of failure into a SourceError with a clear kind", async () => {
    const kindOf = async (fetchFn: typeof fetch) => {
      try {
        await fetchJson(fetchFn, "https://x", {}, options);
      } catch (err) {
        return err instanceof SourceError ? [err.kind, err.message] : "not a SourceError";
      }
    };
    expect(await kindOf(answering(401))).toEqual(["refused", "Example refused the key. Check EXAMPLE_KEY in .env.local."]);
    expect((await kindOf(answering(429)))?.[0]).toBe("rate-limited");
    expect((await kindOf(answering(502)))?.[0]).toBe("server");
    expect((await kindOf(answering(200, "<html>not json")))?.[0]).toBe("bad-answer");
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect((await kindOf(offline))?.[0]).toBe("unreachable");
  });

  it("can treat other codes as 'refused' (Twitch uses 400 and 403)", async () => {
    await expect(
      fetchJson(answering(403), "https://x", {}, { label: "Twitch", refusedStatuses: [400, 403] }),
    ).rejects.toThrow("Twitch refused the key.");
  });
});
