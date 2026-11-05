// Small helpers that EVERY source adapter uses (TMDB, AniList, Open Library,
// IGDB). Most of them were in lib/tmdb in Stage 2; they moved here so the
// other adapters can reuse them instead of copying them.
// Nothing in here knows about one particular API.

export const QUERY_MAX = 100;

/** How long we wait for an outside API before giving up (milliseconds). */
export const REQUEST_TIMEOUT_MS = 8000;

/** Trims the search text and cuts it to a sane length. */
export function cleanQuery(query: string): string {
  return query.trim().slice(0, QUERY_MAX);
}

/**
 * Lowercase, no accents, no punctuation: "Amélie!" and "amelie" now match,
 * and so do "Your Name." and "your name".
 * NFD splits "é" into "e" + an accent mark, and the first regex removes the marks.
 */
export function normalizeText(text: string | null | undefined): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** True when the search text appears in at least one of the titles (used by the sample searches). */
export function matchesQuery(query: string, titles: (string | null | undefined)[]): boolean {
  const wanted = normalizeText(query);
  if (!wanted) return false;
  return titles.some((title) => normalizeText(title).includes(wanted));
}

/** "2014-11-05" -> 2014. "" or junk -> null (TMDB uses "" for unknown dates). */
export function yearFromDate(date: string | null | undefined): number | null {
  const match = /^(\d{4})/.exec(date ?? "");
  return match ? cleanYear(Number(match[1])) : null;
}

// KEEP IN SYNC with `media_items.year` in the Stage 2 migration (between 1800 and 2200).
// A year the database would refuse becomes "unknown" (null) instead, so logging
// an old book like Don Quixote (1605) still works.
export const YEAR_MIN = 1800;
export const YEAR_MAX = 2200;

export function cleanYear(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= YEAR_MIN && value <= YEAR_MAX ? value : null;
}

/** Episodes, chapters or pages: a whole number above 0, or null (the database refuses 0). */
export function cleanTotalUnits(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

/** Trimmed text, or null when empty or not text at all. */
export function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

// KEEP IN SYNC with `media_items.title` in the migration (1 to 500 characters).
export const TITLE_MAX = 500;

export function cleanTitle(value: unknown): string | null {
  const text = cleanText(value);
  return text ? text.slice(0, TITLE_MAX) : null;
}

/** Only https:// images (the database refuses anything else). */
export function cleanCoverUrl(value: unknown): string | null {
  const text = cleanText(value);
  return text && text.startsWith("https://") ? text : null;
}

/**
 * Removes HTML tags from a description ("<i>Hi</i><br>there" -> "Hi there").
 * React would show the tags as plain text otherwise. We never insert the HTML
 * itself into the page: text from another website could contain a <script>.
 */
export function stripHtml(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const plain = text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return plain || null;
}

/** Keeps the first `max` names, without blanks or repeats. */
export function uniqueNames(names: unknown[], max: number): string[] {
  const result: string[] = [];
  for (const name of names) {
    const text = cleanText(name);
    if (text && !result.includes(text)) result.push(text);
    if (result.length === max) break;
  }
  return result;
}

// KEEP IN SYNC with the check on media_items.genres in the Stage 6 migration.
export const GENRES_MAX = 12;

/**
 * Stage 6: a source's genre words, trimmed, without blanks or repeats (ignoring
 * case: "Drama" and "drama" are one), at most GENRES_MAX, each at most 100 characters.
 */
export function cleanGenres(names: unknown[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const text = cleanText(name)?.slice(0, 100);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    result.push(text);
    if (result.length === GENRES_MAX) break;
  }
  return result;
}

/**
 * An Error that also says WHAT KIND of problem it was, so code can react to
 * one kind (e.g. a refused key) without reading the message text.
 * `extends Error` = "a SourceError is an Error, plus a `kind`".
 */
export class SourceError extends Error {
  constructor(
    message: string,
    readonly kind: "unreachable" | "refused" | "rate-limited" | "server" | "bad-answer",
  ) {
    super(message);
    this.name = "SourceError";
  }
}

export type FetchJsonOptions = {
  /** The name users see in error messages, e.g. "TMDB". */
  label: string;
  /** Status codes that mean "your key/secret is wrong" (default: 401). */
  refusedStatuses?: number[];
  /** Which .env.local variables to check when the key is refused. */
  keyHint?: string;
};

/**
 * Calls an outside API and returns its JSON answer, or throws a SourceError
 * whose message is written for users (and never contains a key).
 * `fetchFn` is a parameter so tests can pass a fake (no live calls in tests).
 */
export async function fetchJson(
  fetchFn: typeof fetch,
  url: string,
  init: RequestInit,
  { label, refusedStatuses = [401], keyHint }: FetchJsonOptions,
): Promise<unknown> {
  let response: Response;
  try {
    // AbortSignal.timeout cancels the request if the API takes too long, so
    // one slow source can't keep the whole search waiting forever.
    response = await fetchFn(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    // fetch only throws when there's no answer at all (offline, DNS, timeout...).
    throw new SourceError(`Couldn't reach ${label}. Check your internet connection and try again.`, "unreachable");
  }

  if (refusedStatuses.includes(response.status)) {
    throw new SourceError(`${label} refused the key.${keyHint ? ` Check ${keyHint} in .env.local.` : ""}`, "refused");
  }
  if (response.status === 429) {
    throw new SourceError(`Too many searches sent to ${label} at once. Wait a few seconds and try again.`, "rate-limited");
  }
  if (!response.ok) {
    throw new SourceError(`${label} had a problem (error ${response.status}). Try again later.`, "server");
  }
  try {
    return await response.json();
  } catch {
    throw new SourceError(`${label} sent an answer we couldn't read. Try again later.`, "bad-answer");
  }
}
