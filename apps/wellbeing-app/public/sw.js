// The SERVICE WORKER: a small script the browser runs in the background, in
// between our pages and the internet. Every request the app makes (pages,
// JavaScript, icons) passes through the "fetch" listener at the bottom, and we
// decide: answer from the internet, from our saved copies (the cache), or both.
// That is what lets the app open with no connection.
//
// This file is NOT processed by Next.js. The browser downloads /sw.js exactly
// as written, so it is plain JavaScript (no TypeScript, no imports).
//
// Layout of this file:
//   1. Settings (cache names, the pages to save in advance)
//   2. Pure decision functions: no network, no cache, easy to test.
//      lib/pwa/service-worker.test.ts runs this file in a sandbox and tests them.
//   3. The event listeners that actually touch the network and the cache.
//
// Rule of thumb: we only cache things that are the SAME for every user (page
// shells, JavaScript, icons). Personal data (profiles, check-ins, journal) is
// never stored here. It goes straight to Supabase, protected by RLS.

// ---------------------------------------------------------------------------
// 1. Settings
// ---------------------------------------------------------------------------

// Bump this ("v2", "v3"...) when you change how caching works. The new service
// worker then deletes the old caches when it takes over (see "activate").
const CACHE_VERSION = "v1";
const CACHE_PREFIX = "wellbeing-";
// Pages, the manifest and icons. Refreshed from the internet whenever we're online.
const PAGES_CACHE = `${CACHE_PREFIX}pages-${CACHE_VERSION}`;
// Next.js's built files (/_next/static/...). Their names contain a hash of
// their content, so a given URL never changes: once saved, it's good forever.
const STATIC_CACHE = `${CACHE_PREFIX}static-${CACHE_VERSION}`;

// The "app shell": pages saved in advance, when the service worker installs,
// so they open offline even if you never visited them.
// Stage 2: "/checkin" (the daily check-in) and "/habits" (add/archive habits).
// Stage 3: "/streaks" (streaks + calendars) and "/breathe" (breathing exercise).
// They are page SHELLS, the same for everyone: your answers are never in here.
const APP_SHELL = [
  "/",
  "/checkin",
  "/habits",
  "/streaks",
  "/breathe",
  "/login",
  "/signup",
  "/onboarding",
  "/profile",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

// Shown when you're offline and open a page that was never saved.
const OFFLINE_PAGE = "/offline";

// ---------------------------------------------------------------------------
// 2. Pure decision functions (tested in lib/pwa/service-worker.test.ts)
// ---------------------------------------------------------------------------

/**
 * Decides how to answer one request. Returns one of:
 * - "skip":          don't touch it, the browser does its normal thing
 * - "cache-first":   use the saved copy if we have one, else download and save it
 * - "network-first": try the internet (and save a copy), use the saved copy if offline
 * - "page":          like network-first, plus the offline page as a last resort
 *
 * `request` is a plain object { url, method, mode, isRsc } (see describeRequest),
 * so tests can call this without a real browser Request.
 */
function chooseStrategy(request, appOrigin) {
  // Only GET requests are "reading". POST/PUT/DELETE change data ("save my
  // check-in") and must always reach the server, never a cache. (Saving while
  // offline is handled by the app itself: lib/checkin/offline.ts.)
  if (request.method !== "GET") return "skip";

  const url = new URL(request.url);

  // Other websites (e.g. our Supabase database at *.supabase.co): never cached.
  // Those answers are personal data and login tokens.
  if (url.origin !== appOrigin) return "skip";

  // When you click a link, Next.js fetches a small data file for the next page
  // (an "RSC payload": ?_rsc=... or the "RSC: 1" header) instead of the full
  // page. Skipping it is fine: offline, that fetch fails and Next.js falls back
  // to loading the full page, which "page" below answers from the cache.
  if (request.isRsc || url.searchParams.has("_rsc")) return "skip";

  // Built JavaScript and CSS with a hash in their name: never change.
  if (url.pathname.startsWith("/_next/static/")) return "cache-first";

  // Other Next.js internals (image resizing, dev hot-reload) and our own
  // future server routes (/api/...) must always be live.
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/api/")) return "skip";

  // The service worker file itself: the browser handles its updates.
  if (url.pathname === "/sw.js") return "skip";

  // Opening a page (typing the URL, tapping the home screen icon, reloading).
  if (request.mode === "navigate") return "page";

  // Everything else from our site: icons, manifest...
  return "network-first";
}

/**
 * Only keep copies of complete, successful answers from our own site.
 * Never cache errors (404, 500), partial answers (206), or redirects: serving
 * a saved error or redirect later would break the page.
 */
function shouldCache(response) {
  return response.status === 200 && response.type === "basic" && !response.redirected;
}

/**
 * Finds the built files a page needs (/_next/static/... JavaScript and CSS) in
 * its HTML. When we save a page in advance, we save these too, otherwise the
 * page would open offline as plain text with no styles and no buttons.
 * Returns each URL once.
 */
function extractAssetUrls(html) {
  // Stops at quotes, spaces, < > ) and backslashes, which end a URL in HTML,
  // CSS or the escaped JSON that Next.js puts inside <script> tags.
  const full = html.match(/\/_next\/static\/[^"'\s<>)\\]+/g) || [];
  // Inside its <script> data, Next.js also writes "static/chunks/abc.js"
  // without the "/_next/" in front. Find those and add it back.
  const short = (html.match(/["']static\/(?:chunks|css|media)\/[^"'\s<>)\\]+/g) || []).map(
    (match) => "/_next/" + match.slice(1), // slice(1) drops the opening quote
  );
  return [...new Set([...full, ...short])];
}

/**
 * Which of the existing caches to delete when a new service worker takes over:
 * our own caches from older versions. Caches of anything else are left alone.
 */
function cachesToDelete(existingNames, keepNames) {
  return existingNames.filter((name) => name.startsWith(CACHE_PREFIX) && !keepNames.includes(name));
}

/** Turns a real browser Request into the plain object chooseStrategy expects. */
function describeRequest(request) {
  return {
    url: request.url,
    method: request.method,
    mode: request.mode,
    isRsc: request.headers.get("RSC") === "1",
  };
}

// ---------------------------------------------------------------------------
// 3. Event listeners (these touch the real network and cache)
// ---------------------------------------------------------------------------

// INSTALL: runs once per new version of this file. Save the app shell.
self.addEventListener("install", (event) => {
  // waitUntil = "don't finish installing until this promise is done".
  // If saving the shell fails, the install fails and the browser tries again later.
  event.waitUntil(saveAppShell());
  // Take over right away instead of waiting until every tab is closed.
  // Safe here: pages are network-first, and built files never change.
  self.skipWaiting();
});

async function saveAppShell() {
  const pages = await caches.open(PAGES_CACHE);
  const assetUrls = new Set();

  await Promise.all(
    APP_SHELL.map(async (path) => {
      // cache: "reload" skips the browser's normal HTTP cache, so we save a fresh copy.
      const response = await fetch(path, { cache: "reload" });
      if (!shouldCache(response)) throw new Error(`Could not save ${path} (status ${response.status})`);

      const type = response.headers.get("Content-Type") || "";
      if (type.includes("text/html")) {
        // clone(): a response body can only be read once, and we need it twice
        // (read it here, store it in the cache below).
        const html = await response.clone().text();
        extractAssetUrls(html).forEach((url) => assetUrls.add(url));
      }
      await pages.put(path, response);
    }),
  );

  // The JavaScript/CSS those pages need. One failure here (rare) shouldn't
  // block the whole install, so each file is saved on its own.
  const statics = await caches.open(STATIC_CACHE);
  await Promise.all(
    [...assetUrls].map((url) =>
      statics.add(url).catch(() => {
        // Fine: it will be saved the first time a page uses it ("cache-first").
      }),
    ),
  );
}

// ACTIVATE: the new version takes over. Delete caches from older versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const oldCaches = cachesToDelete(await caches.keys(), [PAGES_CACHE, STATIC_CACHE]);
      await Promise.all(oldCaches.map((name) => caches.delete(name)));
      // Start handling requests of pages that are already open.
      await self.clients.claim();
    })(),
  );
});

// FETCH: every request from our pages comes through here.
self.addEventListener("fetch", (event) => {
  const strategy = chooseStrategy(describeRequest(event.request), self.location.origin);
  // Not calling respondWith means "browser, do what you'd normally do".
  if (strategy === "skip") return;

  if (strategy === "cache-first") {
    event.respondWith(cacheFirst(event.request));
  } else {
    event.respondWith(networkFirst(event.request, strategy === "page"));
  }
});

async function cacheFirst(request) {
  const saved = await caches.match(request);
  if (saved) return saved;

  const response = await fetch(request);
  if (shouldCache(response)) {
    const statics = await caches.open(STATIC_CACHE);
    await statics.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, isPage) {
  try {
    const response = await fetch(request);
    if (shouldCache(response)) {
      // Keep the saved copy up to date for the next time we're offline.
      const pages = await caches.open(PAGES_CACHE);
      await pages.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // fetch() throws (instead of returning a response) when there's no network.
    // ignoreSearch: "/?from=homescreen" can use the saved "/".
    // ignoreVary: our saved pages are the same whatever headers asked for them.
    const saved = await caches.match(request, { ignoreSearch: isPage, ignoreVary: true });
    if (saved) return saved;

    if (isPage) {
      const offline = await caches.match(OFFLINE_PAGE, { ignoreVary: true });
      if (offline) return offline;
    }
    throw error; // nothing saved: the browser shows its normal "no internet" error
  }
}
