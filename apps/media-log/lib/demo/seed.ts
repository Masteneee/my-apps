// DEMO MODE ONLY: three made-up people, so the social features (feed, likes,
// lists) have someone to show while you're the only person in this browser.
//
// The /feed page shows an "Add demo people" button in demo mode. It calls
// seedDemoPeople(), which adds to the two demo "databases" in localStorage:
// - the accounts and profiles (media-log:mock-db, see lib/auth/mock.ts)
// - their logs, reviews, likes, follows and one list (media-log:mock-media)
//
// Everyone is clearly labeled: usernames start with "demo_", display names end
// with "(demo)", and the bio says it's not a real person. You can even log in
// as them (email below, password DEMO_PASSWORD) to like YOUR reviews.
//
// This file is never used with Supabase: real accounts there are real people.

import { MOCK_STORAGE_KEY, type KeyValueStorage, type MockDatabase } from "../auth/mock";
import type { Profile } from "../auth/types";
import { loadMockMediaDatabase, saveMockMediaDatabase } from "../media/mock";
import type { Log, LogStatus, MediaItem, ProgressUnit } from "../media/types";
import { validateLogInput, localToday, mediaItemToResult } from "../media/validation";

export const DEMO_PASSWORD = "demo-password";

type DemoPerson = { id: string; email: string; username: string; displayName: string; bio: string };

export const DEMO_PEOPLE: DemoPerson[] = [
  {
    id: "demo-user-aiko",
    email: "aiko@demo.test",
    username: "demo_aiko",
    displayName: "Aiko (demo)",
    bio: "Demo account, not a real person. Anime and manga first, movies when friends insist.",
  },
  {
    id: "demo-user-leo",
    email: "leo@demo.test",
    username: "demo_leo",
    displayName: "Leo (demo)",
    bio: "Demo account, not a real person. Movies and series. Slowly getting into anime.",
  },
  {
    id: "demo-user-sam",
    email: "sam@demo.test",
    username: "demo_sam",
    displayName: "Sam (demo)",
    bio: "Demo account, not a real person. Games and sci-fi books.",
  },
];

// The items they log, copied from the saved search samples (lib/sources/samples/),
// so they're the SAME items search finds: if you log Interstellar yourself, your
// log and Leo's point to one cached item. seed.test.ts checks they still match.
type DemoItem = Omit<MediaItem, "id" | "cached_at">;
const item = (fields: DemoItem) => fields;

export const DEMO_ITEMS = {
  interstellar: item({ type: "movie", source: "tmdb", source_id: "157336", title: "Interstellar", year: 2014, cover_url: "https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", creators: [], total_units: null, genres: ["Adventure", "Drama", "Science Fiction"] }),
  inception: item({ type: "movie", source: "tmdb", source_id: "27205", title: "Inception", year: 2010, cover_url: "https://image.tmdb.org/t/p/w342/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg", creators: [], total_units: null, genres: ["Action", "Science Fiction", "Adventure"] }),
  severance: item({ type: "series", source: "tmdb", source_id: "95396", title: "Severance", year: 2022, cover_url: "https://image.tmdb.org/t/p/w342/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg", creators: [], total_units: null, genres: ["Drama", "Mystery", "Sci-Fi & Fantasy"] }),
  spiritedAway: item({ type: "anime", source: "anilist", source_id: "199", title: "Spirited Away", year: 2001, cover_url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx199-dn9Pdd6I2JNz.jpg", creators: ["Studio Ghibli"], total_units: 1, genres: ["Adventure", "Drama", "Supernatural"] }),
  planetesAnime: item({ type: "anime", source: "anilist", source_id: "329", title: "Planetes", year: 2003, cover_url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx329-sB6hn9wPzmRG.jpg", creators: ["Sunrise"], total_units: 26, genres: ["Drama", "Romance", "Sci-Fi", "Space", "Astronauts"] }),
  frieren: item({ type: "anime", source: "anilist", source_id: "154587", title: "Frieren: Beyond Journey’s End", year: 2023, cover_url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n1fmjRv4JQUd.jpg", creators: ["MADHOUSE"], total_units: 28, genres: ["Adventure", "Drama", "Fantasy", "Iyashikei"] }),
  cowboyBebop: item({ type: "anime", source: "anilist", source_id: "1", title: "Cowboy Bebop", year: 1998, cover_url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1-CXtrrkMpJ8Zq.png", creators: ["Sunrise"], total_units: 26, genres: ["Action", "Adventure", "Drama", "Sci-Fi", "Space", "Noir"] }),
  fmab: item({ type: "anime", source: "anilist", source_id: "5114", title: "Fullmetal Alchemist: Brotherhood", year: 2009, cover_url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx5114-KJTQz9AIm6Wk.jpg", creators: ["bones"], total_units: 64, genres: ["Action", "Adventure", "Drama", "Fantasy", "Military"] }),
  planetesManga: item({ type: "manga", source: "anilist", source_id: "30044", title: "Planetes", year: 1999, cover_url: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30044-xPLKKQAE3Gl0.jpg", creators: ["Makoto Yukimura"], total_units: 26, genres: ["Drama", "Sci-Fi", "Slice of Life", "Space", "Astronauts"] }),
  hailMary: item({ type: "book", source: "openlibrary", source_id: "OL21745884W", title: "Project Hail Mary", year: 2021, cover_url: "https://covers.openlibrary.org/b/id/11200092-M.jpg", creators: ["Andy Weir"], total_units: 496, genres: ["Science fiction", "Space flight", "Astronauts", "Interstellar travel", "Fiction, science fiction, action & adventure", "Humorous fiction"] }),
  theMartian: item({ type: "book", source: "openlibrary", source_id: "OL17091839W", title: "The Martian", year: 2011, cover_url: "https://covers.openlibrary.org/b/id/11446816-M.jpg", creators: ["Andy Weir"], total_units: 384, genres: ["Science fiction", "Mars (Planet)", "Space flight", "Astronauts", "Fiction, science fiction, general"] }),
  hollowKnight: item({ type: "game", source: "igdb", source_id: "14593", title: "Hollow Knight", year: 2017, cover_url: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1rgi.jpg", creators: ["Team Cherry"], total_units: null, genres: ["Platform", "Adventure", "Indie", "Action", "Fantasy"] }),
  outerWilds: item({ type: "game", source: "igdb", source_id: "11737", title: "Outer Wilds", year: 2019, cover_url: "https://images.igdb.com/igdb/image/upload/t_cover_big/co65ac.jpg", creators: ["Mobius Digital"], total_units: null, genres: ["Puzzle", "Adventure", "Indie", "Science fiction", "Mystery", "Open world"] }),
} satisfies Record<string, DemoItem>;

type ItemKey = keyof typeof DEMO_ITEMS;

type DemoLog = {
  id: string;
  user: string; // a DEMO_PEOPLE id
  item: ItemKey;
  status: LogStatus;
  rating?: number;
  review?: string;
  progress?: number;
  unit?: ProgressUnit;
  rewatch?: boolean;
  hoursAgo: number; // when it was logged, counted back from "now"
};

const DEMO_LOGS: DemoLog[] = [
  { id: "demo-log-1", user: "demo-user-aiko", item: "frieren", status: "completed", rating: 5, hoursAgo: 3,
    review: "A fantasy story about what happens AFTER the quest. Quiet, funny, and it made me cry twice. Start here even if you never watch anime." },
  { id: "demo-log-2", user: "demo-user-aiko", item: "planetesManga", status: "in_progress", progress: 14, unit: "chapter", hoursAgo: 20 },
  { id: "demo-log-3", user: "demo-user-aiko", item: "cowboyBebop", status: "completed", rating: 4.5, hoursAgo: 50,
    review: "Space jazz noir. Every episode feels like a different movie." },
  { id: "demo-log-4", user: "demo-user-aiko", item: "spiritedAway", status: "completed", rating: 5, rewatch: true, hoursAgo: 120 },
  { id: "demo-log-5", user: "demo-user-leo", item: "interstellar", status: "completed", rating: 4.5, hoursAgo: 6,
    review: "The docking scene still makes my hands sweat. The science is shaky, the feelings are not." },
  { id: "demo-log-6", user: "demo-user-leo", item: "severance", status: "in_progress", progress: 6, unit: "episode", hoursAgo: 30 },
  { id: "demo-log-7", user: "demo-user-leo", item: "planetesAnime", status: "planned", hoursAgo: 2 },
  { id: "demo-log-8", user: "demo-user-leo", item: "inception", status: "completed", rating: 4, hoursAgo: 96 },
  { id: "demo-log-9", user: "demo-user-sam", item: "outerWilds", status: "completed", rating: 5, progress: 22, unit: "hour", hoursAgo: 10,
    review: "Go in knowing nothing. A solar system that is a puzzle box, and the best ending I've played." },
  { id: "demo-log-10", user: "demo-user-sam", item: "hollowKnight", status: "in_progress", progress: 31.5, unit: "hour", hoursAgo: 26 },
  { id: "demo-log-11", user: "demo-user-sam", item: "hailMary", status: "completed", rating: 4.5, hoursAgo: 72,
    review: "Like The Martian, but with a friend. Funny science, big heart." },
  { id: "demo-log-12", user: "demo-user-sam", item: "theMartian", status: "planned", hoursAgo: 71 },
];

// Who follows whom (the demo people follow each other, not you: you choose).
const DEMO_FOLLOWS: [follower: string, following: string][] = [
  ["demo-user-aiko", "demo-user-leo"],
  ["demo-user-leo", "demo-user-aiko"],
  ["demo-user-sam", "demo-user-aiko"],
  ["demo-user-sam", "demo-user-leo"],
];

// Who liked which review (never their own: same rule as likeProblem()).
const DEMO_LIKES: [user: string, log: string][] = [
  ["demo-user-leo", "demo-log-1"],
  ["demo-user-sam", "demo-log-1"],
  ["demo-user-sam", "demo-log-5"],
  ["demo-user-aiko", "demo-log-9"],
];

const DEMO_LIST = {
  id: "demo-list-1",
  user_id: "demo-user-aiko",
  title: "Best anime for people who don't watch anime",
  description: "No 500-episode marathons. Each one works like a great movie or a short series.",
  is_public: true,
  items: ["spiritedAway", "cowboyBebop", "frieren", "planetesAnime", "fmab"] as ItemKey[],
};

/** True when the demo people were already added in this browser. */
export function hasDemoPeople(storage: KeyValueStorage): boolean {
  return loadAuthDatabase(storage).users.some((user) => user.id === DEMO_PEOPLE[0].id);
}

function loadAuthDatabase(storage: KeyValueStorage): MockDatabase {
  const raw = storage.getItem(MOCK_STORAGE_KEY);
  const empty: MockDatabase = { users: [], profiles: [], currentUserId: null };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as Partial<MockDatabase>;
    return { users: parsed.users ?? [], profiles: parsed.profiles ?? [], currentUserId: parsed.currentUserId ?? null };
  } catch {
    return empty;
  }
}

/**
 * Adds the demo people, their logs, likes, follows and list. Safe to call twice:
 * the second time it does nothing and returns false.
 * Your own account, logs and login stay exactly as they were.
 */
export function seedDemoPeople(storage: KeyValueStorage, now: Date = new Date()): boolean {
  if (hasDemoPeople(storage)) return false;

  // 1) Accounts and profiles (the demo AUTH data).
  const auth = loadAuthDatabase(storage);
  for (const person of DEMO_PEOPLE) {
    if (auth.profiles.some((p) => p.username === person.username)) {
      throw new Error(`Someone in this browser already uses the username ${person.username}.`);
    }
  }
  for (const person of DEMO_PEOPLE) {
    auth.users.push({ id: person.id, email: person.email, password: DEMO_PASSWORD });
    const profile: Profile = {
      id: person.id,
      username: person.username,
      display_name: person.displayName,
      avatar_url: null,
      bio: person.bio,
    };
    auth.profiles.push(profile);
  }

  // 2) Items, logs, likes, follows, list (the demo MEDIA data).
  const media = loadMockMediaDatabase(storage);
  const timeAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

  // Reuse an item someone already cached (same source + type + id), or cache it.
  const itemIds = new Map<ItemKey, string>();
  for (const [key, fields] of Object.entries(DEMO_ITEMS) as [ItemKey, DemoItem][]) {
    let cached = media.mediaItems.find(
      (m) => m.source === fields.source && m.type === fields.type && m.source_id === fields.source_id,
    );
    if (!cached) {
      cached = { id: `demo-item-${key}`, ...fields, cached_at: now.toISOString() };
      media.mediaItems.push(cached);
    }
    itemIds.set(key, cached.id);
  }

  for (const demo of DEMO_LOGS) {
    // Run every demo log through the SAME checks as the log form, so the demo
    // data can never be something a real user couldn't save.
    const fields = DEMO_ITEMS[demo.item];
    const checked = validateLogInput(
      {
        media: mediaItemToResult({ id: "", cached_at: "", ...fields }),
        status: demo.status,
        rating: demo.rating ?? null,
        reviewText: demo.review ?? "",
        finishedAt: null,
        rewatch: demo.rewatch ?? false,
        progress: demo.progress ?? null,
        progressUnit: demo.unit ?? null,
      },
      localToday(now),
    );
    if (!checked.ok) throw new Error(`Demo log ${demo.id} is invalid: ${checked.error}`);
    const log: Log = {
      id: demo.id,
      user_id: demo.user,
      media_item_id: itemIds.get(demo.item)!, // "!" = we know it's there (every key was added above)
      ...checked.value,
      started_at: null,
      created_at: timeAgo(demo.hoursAgo),
    };
    media.logs.push(log);
  }

  for (const [follower, following] of DEMO_FOLLOWS) {
    media.follows.push({ follower_id: follower, following_id: following, created_at: now.toISOString() });
  }
  for (const [user, log] of DEMO_LIKES) {
    media.likes.push({ user_id: user, log_id: log, created_at: now.toISOString() });
  }

  const { items, ...list } = DEMO_LIST;
  media.lists.push({ ...list, created_at: timeAgo(48) });
  items.forEach((key, position) => {
    media.listItems.push({ list_id: list.id, media_item_id: itemIds.get(key)!, position, note: null });
  });

  // Save both at the end, so a problem above leaves nothing half-added.
  storage.setItem(MOCK_STORAGE_KEY, JSON.stringify(auth));
  saveMockMediaDatabase(storage, media);
  return true;
}
