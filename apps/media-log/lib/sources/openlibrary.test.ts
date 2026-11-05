import { describe, expect, it, vi } from "vitest";
import {
  buildOpenLibraryRequest,
  convertOpenLibraryResponse,
  createOpenLibrarySampleSource,
  createOpenLibrarySource,
  openLibraryDocToMediaResult,
  openLibraryGenres,
  searchOpenLibrarySample,
  workIdFromKey,
  type OpenLibrarySearchResponse,
} from "./openlibrary";
import sampleJson from "./samples/openlibrary-search.json";

const sample = sampleJson as OpenLibrarySearchResponse;
const dune = sample.docs.find((d) => d.key === "/works/OL893415W")!;
const BOOKS = { types: ["book"] as const, limit: 10 };

describe("openLibraryDocToMediaResult", () => {
  it("converts a work: authors as creators, median pages as units", () => {
    expect(openLibraryDocToMediaResult(dune)).toEqual({
      type: "book",
      source: "openlibrary",
      sourceId: "OL893415W",
      title: "Dune",
      originalTitle: null,
      year: 1965,
      coverUrl: "https://covers.openlibrary.org/b/id/11481354-M.jpg",
      creators: ["Frank Herbert"],
      totalUnits: 604,
      overview: null,
      // Only the subjects our tag map understands (not "Dune (Imaginary place)" or "Large type books").
      genres: ["Science fiction", "Life on other planets", "Fiction, science fiction, general", "Interplanetary voyages"],
    });
  });

  it("keeps only the subjects our tag map understands (Stage 6)", () => {
    expect(openLibraryGenres(["Science fiction", "Arrakis (Imaginary place)", "Large type books", "Space flight -- Fiction"])).toEqual([
      "Science fiction",
      "Space flight -- Fiction",
    ]);
    expect(openLibraryGenres(undefined)).toEqual([]);
    expect(openLibraryGenres(["Fantasy fiction", 42, null])).toEqual(["Fantasy fiction"]);
  });

  it("uses the subtitle as a short description", () => {
    const hobbit = sample.docs.find((d) => d.title === "The Hobbit")!;
    expect(openLibraryDocToMediaResult(hobbit).overview).toBe("or There and Back Again");
  });

  it("handles a work with only a key and a title", () => {
    expect(openLibraryDocToMediaResult({ key: "/works/OL1W", title: "Bare" })).toMatchObject({
      year: null,
      coverUrl: null,
      creators: [],
      totalUnits: null,
    });
  });

  it("drops years the database would refuse (before 1800)", () => {
    const quixote = sample.docs.find((d) => d.title === "Don Quixote")!;
    expect(quixote.first_publish_year).toBe(1605);
    expect(openLibraryDocToMediaResult(quixote).year).toBeNull();
  });

  it("shortens the work key into an id", () => {
    expect(workIdFromKey("/works/OL82563W")).toBe("OL82563W");
  });
});

describe("convertOpenLibraryResponse", () => {
  it("converts every work in the saved sample", () => {
    const results = convertOpenLibraryResponse(sample);
    expect(results).toHaveLength(sample.docs.length);
    expect(results.every((r) => r.type === "book" && r.source === "openlibrary")).toBe(true);
  });

  it("skips things that aren't works, and junk", () => {
    const results = convertOpenLibraryResponse({
      docs: [dune, { key: "/authors/OL1A", title: "An author?" }, { title: "no key" }, null],
    });
    expect(results.map((r) => r.sourceId)).toEqual(["OL893415W"]);
    expect(convertOpenLibraryResponse({ error: "oops" })).toEqual([]);
    expect(convertOpenLibraryResponse(undefined)).toEqual([]);
  });
});

describe("createOpenLibrarySource (with a fake fetch, no live calls)", () => {
  it("asks only for the fields we use, says who we are, and converts the answer", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(sample), { status: 200 }));
    const results = await createOpenLibrarySource(fetchFn as unknown as typeof fetch).search(" dune ", BOOKS);

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/openlibrary\.org\/search\.json\?q=dune&fields=key%2Ctitle/);
    expect(url).toContain("limit=10");
    expect((init.headers as Record<string, string>)["user-agent"]).toContain("MediaLog");
    expect(results[0].title).toBe("Dune");
  });

  it("encodes the search text in the address", () => {
    const { url } = buildOpenLibraryRequest("cien años & co", 5);
    expect(url).toContain("q=cien+a%C3%B1os+%26+co");
    expect(url).toContain("limit=5");
  });

  it("doesn't call Open Library when books aren't wanted", async () => {
    const fetchFn = vi.fn();
    expect(await createOpenLibrarySource(fetchFn as unknown as typeof fetch).search("dune", { types: [], limit: 5 })).toEqual(
      [],
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("explains server errors", async () => {
    const fetchFn = vi.fn(async () => new Response("down", { status: 503 }));
    await expect(createOpenLibrarySource(fetchFn as unknown as typeof fetch).search("x", BOOKS)).rejects.toThrow(
      "Open Library had a problem (error 503)",
    );
  });
});

describe("Open Library sample search", () => {
  it("matches titles and authors, ignoring accents", async () => {
    const source = createOpenLibrarySampleSource();
    expect(source.mode).toBe("sample");
    const titles = async (q: string) => (await source.search(q, BOOKS)).map((r) => r.title);
    expect(await titles("andy weir")).toEqual(["The Martian", "Project Hail Mary"]);
    expect(await titles("cien anos")).toEqual(["Cien años de soledad"]);
  });

  it("answers in Open Library's shape and respects the limit", () => {
    const answer = searchOpenLibrarySample("dune", 2);
    expect(answer.docs).toHaveLength(2);
    expect(answer).toMatchObject({ numFound: 2, start: 0, q: "dune" });
  });
});
