// AniList adapter: anime AND manga. AniList needs no key.
//
// AniList uses GraphQL instead of a normal "REST" API: there is ONE address
// (https://graphql.anilist.co), and we POST a query that lists exactly the
// fields we want. The answer has the same shape as the query.
//
// Two versions behind the SourceAdapter contract, like every adapter:
// createAniListSource (real API) and createAniListSampleSource (saved sample).

import { genreToTags } from "../media/tags";
import type { MediaResult } from "../media/types";
import sample from "./samples/anilist-search.json";
import {
  cleanCoverUrl,
  cleanGenres,
  cleanQuery,
  cleanTitle,
  cleanTotalUnits,
  cleanYear,
  fetchJson,
  matchesQuery,
  SourceError,
  stripHtml,
  uniqueNames,
} from "./shared";
import type { SourceAdapter, SourceSearchOptions } from "./types";

// ---------------------------------------------------------------------------
// AniList's own shapes (from docs.anilist.co). Only this file uses them.
// Most fields can be null in AniList's schema, so the types say so.
// ---------------------------------------------------------------------------

export type AniListMedia = {
  id: number;
  type: "ANIME" | "MANGA";
  format: string | null; // "TV", "MOVIE", "OVA", "MANGA", "ONE_SHOT", "NOVEL"...
  title: { romaji: string | null; english: string | null; native: string | null };
  synonyms: string[] | null;
  startDate: { year: number | null; month: number | null; day: number | null };
  coverImage: { large: string | null } | null;
  episodes: number | null; // anime only, null while still airing
  chapters: number | null; // manga only, null while still running
  volumes: number | null;
  description: string | null; // may contain HTML like <br> and <i>
  isAdult: boolean | null;
  // Anime: the animation studio. Manga: the people who wrote/drew it.
  studios: { nodes: { name: string }[] } | null;
  staff: { edges: { role: string; node: { name: { full: string | null } } }[] } | null;
  // Stage 6. `genres` is AniList's short fixed list ("Action", "Sci-Fi", "Slice of Life"...).
  // `tags` are hundreds of finer labels ("Space", "Iyashikei"...), each with a `rank`:
  // how strongly it applies, 0 to 100, voted by users. Some tags give away the
  // story, so AniList marks them `isMediaSpoiler`. Both may be missing in older saves.
  genres?: string[] | null;
  tags?: { name: string; rank: number | null; isMediaSpoiler: boolean | null }[] | null;
};

/** Our query asks for an "anime" part and/or a "manga" part (see buildAniListQuery). */
export type AniListSearchResponse = {
  data: {
    anime?: { media: AniListMedia[] } | null;
    manga?: { media: AniListMedia[] } | null;
  } | null;
  errors?: { message: string; status?: number }[];
};

// ---------------------------------------------------------------------------
// Converting AniList's answers into MediaResult
// ---------------------------------------------------------------------------

// Manga staff roles that count as "creators" (not translators, letterers...).
const CREATOR_ROLE = /story|art|original creator/i;

// Stage 6: a tag must apply at least this much (AniList's rank, out of 100) to count.
export const ANILIST_TAG_MIN_RANK = 60;

/**
 * The genre words we keep for one entry: every genre (a short fixed list), then
 * the tags that are strong enough, aren't spoilers, and that our shared tag map
 * understands (lib/media/tags.ts). Unknown tags like "Male Protagonist" are dropped,
 * so we don't store hundreds of words nobody uses.
 */
export function aniListGenres(media: Pick<AniListMedia, "genres" | "tags">): string[] {
  const tags = (media.tags ?? [])
    .filter((tag) => (tag.rank ?? 0) >= ANILIST_TAG_MIN_RANK && tag.isMediaSpoiler !== true)
    .map((tag) => tag.name)
    .filter((name) => typeof name === "string" && genreToTags(name).length > 0);
  return cleanGenres([...(media.genres ?? []), ...tags]);
}

/** One AniList entry -> one MediaResult. */
export function aniListMediaToMediaResult(media: AniListMedia): MediaResult {
  const isAnime = media.type === "ANIME";
  const english = cleanTitle(media.title.english);
  const romaji = cleanTitle(media.title.romaji);
  const native = cleanTitle(media.title.native);
  // English first (friendlier for people new to anime), then the
  // romanized Japanese ("Shingeki no Kyojin"), then the Japanese script.
  const title = english ?? romaji ?? native ?? "Untitled";
  const original = [native, romaji].find((other) => other && other !== title) ?? null;

  const creators = isAnime
    ? uniqueNames(media.studios?.nodes.map((studio) => studio.name) ?? [], 2)
    : uniqueNames(
        (media.staff?.edges ?? []).filter((edge) => CREATOR_ROLE.test(edge.role)).map((edge) => edge.node.name.full),
        3,
      );

  return {
    type: isAnime ? "anime" : "manga",
    source: "anilist",
    sourceId: String(media.id),
    title,
    originalTitle: original,
    year: cleanYear(media.startDate?.year),
    coverUrl: cleanCoverUrl(media.coverImage?.large),
    creators,
    // Anime are counted in episodes, manga in chapters (Stage 4 tracks progress).
    totalUnits: cleanTotalUnits(isAnime ? media.episodes : media.chapters),
    overview: stripHtml(media.description),
    genres: aniListGenres(media),
  };
}

function looksLikeMedia(value: unknown): value is AniListMedia {
  if (typeof value !== "object" || value === null) return false;
  const media = value as Record<string, unknown>;
  return (
    typeof media.id === "number" &&
    (media.type === "ANIME" || media.type === "MANGA") &&
    typeof media.title === "object" &&
    media.title !== null
  );
}

function mediaListOf(part: unknown): unknown[] {
  if (typeof part !== "object" || part === null) return [];
  const media = (part as { media?: unknown }).media;
  return Array.isArray(media) ? media : [];
}

/**
 * A whole AniList answer -> MediaResults (anime first, then manga).
 * Skips broken entries, adult entries and light novels (format NOVEL: those
 * are books, and Open Library covers books).
 */
export function convertAniListResponse(json: unknown): MediaResult[] {
  if (typeof json !== "object" || json === null) return [];
  const data = (json as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return [];
  const { anime, manga } = data as { anime?: unknown; manga?: unknown };
  return [...mediaListOf(anime), ...mediaListOf(manga)]
    .filter(looksLikeMedia)
    .filter((media) => media.isAdult !== true && media.format !== "NOVEL")
    .map(aniListMediaToMediaResult);
}

// ---------------------------------------------------------------------------
// The real API
// ---------------------------------------------------------------------------

export const ANILIST_API_URL = "https://graphql.anilist.co";

// A GraphQL "fragment" is a named list of fields we can reuse in several
// places of the query (here: in the anime part and in the manga part).
const MEDIA_FIELDS = `fragment mediaFields on Media {
  id type format
  title { romaji english native }
  synonyms
  startDate { year month day }
  coverImage { large }
  episodes chapters volumes
  description(asHtml: false)
  isAdult
  studios(isMain: true) { nodes { name } }
  staff(perPage: 4, sort: [RELEVANCE, ID]) { edges { role node { name { full } } } }
  genres
  tags { name rank isMediaSpoiler }
}`;

/**
 * Builds the GraphQL query. Only the parts we need are included, so a
 * manga-only search doesn't ask for anime. "anime:" and "manga:" are
 * ALIASES: they name each part of the answer (data.anime, data.manga).
 * The search text goes in a VARIABLE ($search), never glued into the query,
 * so quotes or braces in the text can't break it.
 */
export function buildAniListQuery(types: readonly ("anime" | "manga")[]): string {
  const parts = types.map((type) => {
    const extra = type === "manga" ? ", format_not: NOVEL" : "";
    return `  ${type}: Page(perPage: $perPage) {
    media(search: $search, type: ${type.toUpperCase()}, isAdult: false${extra}, sort: SEARCH_MATCH) { ...mediaFields }
  }`;
  });
  return `query ($search: String, $perPage: Int) {\n${parts.join("\n")}\n}\n${MEDIA_FIELDS}`;
}

/** Which of AniList's two types this search wants. */
function aniListTypes(options: SourceSearchOptions): ("anime" | "manga")[] {
  return (["anime", "manga"] as const).filter((type) => options.types.includes(type));
}

export function buildAniListRequest(query: string, options: SourceSearchOptions): { url: string; init: RequestInit } {
  return {
    url: ANILIST_API_URL,
    init: {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        query: buildAniListQuery(aniListTypes(options)),
        variables: { search: query, perPage: options.limit },
      }),
    },
  };
}

const ANILIST_TYPES = ["anime", "manga"] as const;

export function createAniListSource(fetchFn: typeof fetch = fetch): SourceAdapter {
  return {
    source: "anilist",
    label: "AniList",
    types: ANILIST_TYPES,
    mode: "live",
    async search(rawQuery, options) {
      const query = cleanQuery(rawQuery);
      if (!query || aniListTypes(options).length === 0) return [];
      const { url, init } = buildAniListRequest(query, options);
      const json = await fetchJson(fetchFn, url, init, { label: "AniList" });
      // GraphQL can answer "200 OK" and still carry an error list.
      const errors = (json as AniListSearchResponse | null)?.errors;
      if (errors?.length && !(json as AniListSearchResponse).data) {
        throw new SourceError(`AniList had a problem: ${errors[0].message}`, "server");
      }
      return convertAniListResponse(json);
    },
  };
}

// ---------------------------------------------------------------------------
// The saved sample
// ---------------------------------------------------------------------------

/** Searches the saved sample and answers in AniList's own shape (only the parts asked for). */
export function searchAniListSample(query: string, options: SourceSearchOptions): AniListSearchResponse {
  const saved = sample as AniListSearchResponse;
  const pick = (part: { media: AniListMedia[] } | null | undefined) => ({
    media: (part?.media ?? [])
      .filter((m) =>
        matchesQuery(cleanQuery(query), [m.title.english, m.title.romaji, m.title.native, ...(m.synonyms ?? [])]),
      )
      .slice(0, options.limit),
  });
  const types = aniListTypes(options);
  return {
    data: {
      ...(types.includes("anime") ? { anime: pick(saved.data?.anime) } : {}),
      ...(types.includes("manga") ? { manga: pick(saved.data?.manga) } : {}),
    },
  };
}

export function createAniListSampleSource(): SourceAdapter {
  return {
    source: "anilist",
    label: "AniList",
    types: ANILIST_TYPES,
    mode: "sample",
    async search(query, options) {
      if (!cleanQuery(query)) return [];
      return convertAniListResponse(searchAniListSample(query, options));
    },
  };
}
