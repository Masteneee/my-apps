// Stage 6: ONE small shared set of tags for every kind of media.
//
// Every source describes genres in its own words: TMDB says "Science Fiction",
// AniList says "Sci-Fi", Open Library says "Fiction, science fiction, general",
// IGDB says "Science fiction". To compare a movie with a manga we first
// translate all of them into the same few tags ("sci-fi"). That translation
// is this file: pure functions, tested in tags.test.ts.
//
// We store each source's OWN words in media_items.genres, and translate when
// we read them. So if this map gets better later, old items get better too.

import { normalizeText } from "../sources/shared";

/**
 * The shared tags, from MOST specific to MOST general. That order is also the
 * order they're shown in ("shares Space, Sci-Fi, Drama"), so the interesting
 * ones come first. Adding a tag = add it here, give it a label, add aliases.
 */
export const TAGS = [
  "space",
  "post-apocalyptic",
  "supernatural",
  "psychological",
  "slice-of-life",
  "sports",
  "music",
  "war",
  "history",
  "sci-fi",
  "fantasy",
  "horror",
  "mystery",
  "crime",
  "romance",
  "thriller",
  "family",
  "comedy",
  "adventure",
  "action",
  "drama",
] as const;
export type Tag = (typeof TAGS)[number];

export const TAG_LABELS: Record<Tag, string> = {
  space: "Space",
  "post-apocalyptic": "Post-Apocalyptic",
  supernatural: "Supernatural",
  psychological: "Psychological",
  "slice-of-life": "Slice of Life",
  sports: "Sports",
  music: "Music",
  war: "War",
  history: "History",
  "sci-fi": "Sci-Fi",
  fantasy: "Fantasy",
  horror: "Horror",
  mystery: "Mystery",
  crime: "Crime",
  romance: "Romance",
  thriller: "Thriller",
  family: "Family",
  comedy: "Comedy",
  adventure: "Adventure",
  action: "Action",
  drama: "Drama",
};

// Every way a source writes a tag, AFTER tagKey() cleaned it (lowercase, no
// accents, dashes and brackets become spaces): "Sci-Fi" -> "sci fi".
// Words we leave out on purpose (no tag): "Animation" and "Documentary" (a format,
// not a story), "Fiction" (every novel), "Indie", "Puzzle", "Role-playing (RPG)",
// "Strategy", "Open world" (how a game plays, not what it's about), "Western".
const ALIASES: Record<string, Tag[]> = {
  // space
  space: ["space"],
  "outer space": ["space"],
  "space flight": ["space"],
  "space travel": ["space"],
  "space exploration": ["space"],
  "interstellar travel": ["space"],
  "interplanetary voyages": ["space"],
  astronauts: ["space"],
  "mars planet": ["space"],
  "space opera": ["space", "sci-fi"],
  // post-apocalyptic
  "post apocalyptic": ["post-apocalyptic"],
  "post apocalypse": ["post-apocalyptic"],
  "apocalyptic fiction": ["post-apocalyptic"],
  // supernatural
  supernatural: ["supernatural"],
  paranormal: ["supernatural"],
  ghosts: ["supernatural"],
  "ghost stories": ["supernatural"],
  demons: ["supernatural"],
  vampires: ["supernatural", "horror"],
  // psychological
  psychological: ["psychological"],
  "psychological fiction": ["psychological"],
  "psychological thriller": ["psychological", "thriller"],
  // slice of life
  "slice of life": ["slice-of-life"],
  iyashikei: ["slice-of-life"], // Japanese "healing" stories: calm, everyday life
  // sports, music
  sports: ["sports"],
  sport: ["sports"],
  "sports stories": ["sports"],
  racing: ["sports"],
  music: ["music"],
  musical: ["music"],
  // war, history
  war: ["war"],
  warfare: ["war"],
  military: ["war"],
  "war stories": ["war"],
  "world war": ["war", "history"],
  history: ["history"],
  historical: ["history"],
  "historical fiction": ["history"],
  // sci-fi
  "science fiction": ["sci-fi"],
  "sci fi": ["sci-fi"],
  scifi: ["sci-fi"],
  mecha: ["sci-fi"], // giant robots
  cyberpunk: ["sci-fi"],
  dystopias: ["sci-fi"],
  dystopian: ["sci-fi"],
  "time travel": ["sci-fi"],
  "life on other planets": ["sci-fi"],
  // fantasy
  fantasy: ["fantasy"],
  "fantasy fiction": ["fantasy"],
  "high fantasy": ["fantasy"],
  "dark fantasy": ["fantasy"],
  magic: ["fantasy"],
  "magic realism": ["fantasy"],
  "magic realism literature": ["fantasy"],
  "mahou shoujo": ["fantasy"], // "magical girl"
  dragons: ["fantasy"],
  wizards: ["fantasy"],
  // horror
  horror: ["horror"],
  "horror fiction": ["horror"],
  "horror tales": ["horror"],
  "survival horror": ["horror"],
  zombies: ["horror"],
  gore: ["horror"],
  // mystery, crime
  mystery: ["mystery"],
  "mystery fiction": ["mystery"],
  "detective and mystery stories": ["mystery", "crime"],
  detective: ["mystery"],
  crime: ["crime"],
  "crime fiction": ["crime"],
  noir: ["crime"],
  gangsters: ["crime"],
  // romance
  romance: ["romance"],
  "romance fiction": ["romance"],
  "love stories": ["romance"],
  // thriller
  thriller: ["thriller"],
  suspense: ["thriller"],
  "suspense fiction": ["thriller"],
  // family
  family: ["family"],
  kids: ["family"],
  "juvenile fiction": ["family"],
  "childrens stories": ["family"],
  // comedy
  comedy: ["comedy"],
  humor: ["comedy"],
  humour: ["comedy"],
  "humorous fiction": ["comedy"],
  parody: ["comedy"],
  satire: ["comedy"],
  // adventure, action
  adventure: ["adventure"],
  "adventure stories": ["adventure"],
  "adventure fiction": ["adventure"],
  action: ["action"],
  shooter: ["action"],
  fighting: ["action"],
  "hack and slash": ["action"],
  "beat em up": ["action"],
  "martial arts": ["action"],
  // drama
  drama: ["drama"],
  tragedy: ["drama"],
};

/**
 * Cleans one genre word so different spellings meet: "Sci-Fi" -> "sci fi",
 * "Children's stories" -> "childrens stories", "Mars (Planet)" -> "mars planet".
 * Apostrophes are removed first (so "children's" doesn't become "children s").
 */
export function tagKey(text: string): string {
  return normalizeText(text.replace(/['’]/g, ""));
}

// Separators INSIDE one genre text: TMDB's "Action & Adventure", IGDB's
// "Hack and slash/Beat 'em up", Open Library's "Fiction, science fiction, general"
// and "Space flight -- Fiction". We don't split on the word "and", because
// "hack and slash" is ONE thing.
const PIECE_SEPARATORS = /\s*(?:&|\/|,|;|--)\s*/;

/** The tags of one key: an exact alias, or the same word without a plural "s" ("thrillers"). */
function tagsOfKey(key: string): Tag[] {
  return ALIASES[key] ?? (key.endsWith("s") ? (ALIASES[key.slice(0, -1)] ?? []) : []);
}

/** The shared tags for ONE genre text, e.g. "Sci-Fi & Fantasy" -> ["sci-fi", "fantasy"]. Unknown -> []. */
export function genreToTags(genre: string): Tag[] {
  const whole = tagsOfKey(tagKey(genre));
  if (whole.length > 0) return sortTags(whole);
  const found = genre.split(PIECE_SEPARATORS).flatMap((piece) => tagsOfKey(tagKey(piece)));
  return sortTags(found);
}

/** Every shared tag of an item, each once, most specific first. */
export function genresToTags(genres: readonly string[]): Tag[] {
  return sortTags(genres.flatMap(genreToTags));
}

/** Removes repeats and puts tags in TAGS order (most specific first). */
export function sortTags(tags: readonly Tag[]): Tag[] {
  const wanted = new Set(tags);
  return TAGS.filter((tag) => wanted.has(tag));
}

/** ["sci-fi", "drama"] -> "Sci-Fi, Drama". */
export function tagListLabel(tags: readonly Tag[]): string {
  return tags.map((tag) => TAG_LABELS[tag]).join(", ");
}
