import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadServiceWorker, type StrategyRequest } from "./load-service-worker";

const sw = loadServiceWorker();
const APP = "https://wellbeing.example.com";

// Builds a request description with sensible defaults: a normal GET of a file.
function req(path: string, extra: Partial<StrategyRequest> = {}): StrategyRequest {
  return { url: path.startsWith("http") ? path : APP + path, method: "GET", mode: "no-cors", isRsc: false, ...extra };
}

describe("chooseStrategy", () => {
  it("opens pages network-first, with the offline page as a fallback", () => {
    expect(sw.chooseStrategy(req("/", { mode: "navigate" }), APP)).toBe("page");
    expect(sw.chooseStrategy(req("/profile", { mode: "navigate" }), APP)).toBe("page");
    // The check-in page (Stage 2) is covered by the same rule:
    expect(sw.chooseStrategy(req("/checkin", { mode: "navigate" }), APP)).toBe("page");
  });

  it("serves built Next.js files from the cache first (their names never change)", () => {
    expect(sw.chooseStrategy(req("/_next/static/chunks/app/page-3f2a1b.js"), APP)).toBe("cache-first");
    expect(sw.chooseStrategy(req("/_next/static/css/9c1d.css"), APP)).toBe("cache-first");
  });

  it("refreshes icons and the manifest from the network when online", () => {
    expect(sw.chooseStrategy(req("/icons/icon-192.png"), APP)).toBe("network-first");
    expect(sw.chooseStrategy(req("/manifest.webmanifest"), APP)).toBe("network-first");
  });

  it("never touches requests that change data (like saving a check-in)", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(sw.chooseStrategy(req("/", { method, mode: "cors" }), APP)).toBe("skip");
    }
  });

  it("never caches other websites, like the Supabase database (personal data)", () => {
    expect(sw.chooseStrategy(req("https://abc.supabase.co/rest/v1/profiles?id=eq.1"), APP)).toBe("skip");
    expect(sw.chooseStrategy(req("https://abc.supabase.co/auth/v1/token"), APP)).toBe("skip");
  });

  it("leaves Next.js page data (RSC) to the browser, by header or by ?_rsc=", () => {
    expect(sw.chooseStrategy(req("/profile", { isRsc: true, mode: "cors" }), APP)).toBe("skip");
    expect(sw.chooseStrategy(req("/profile?_rsc=abc12", { mode: "cors" }), APP)).toBe("skip");
  });

  it("leaves live-only addresses alone: other Next.js internals, /api and sw.js itself", () => {
    expect(sw.chooseStrategy(req("/_next/image?url=%2Fa.png&w=64&q=75"), APP)).toBe("skip");
    expect(sw.chooseStrategy(req("/_next/webpack-hmr"), APP)).toBe("skip");
    expect(sw.chooseStrategy(req("/api/anything"), APP)).toBe("skip");
    expect(sw.chooseStrategy(req("/sw.js"), APP)).toBe("skip");
  });

  it("checks the whole origin, not just the start of the address", () => {
    // A look-alike domain must not be treated as ours.
    expect(sw.chooseStrategy(req("https://wellbeing.example.com.evil.net/", { mode: "navigate" }), APP)).toBe("skip");
    expect(sw.chooseStrategy(req("http://wellbeing.example.com/", { mode: "navigate" }), APP)).toBe("skip");
  });
});

describe("shouldCache", () => {
  it("keeps complete, successful answers from our own site", () => {
    expect(sw.shouldCache({ status: 200, type: "basic", redirected: false })).toBe(true);
  });

  it("refuses errors, partial answers, redirects and other sites' answers", () => {
    expect(sw.shouldCache({ status: 404, type: "basic", redirected: false })).toBe(false);
    expect(sw.shouldCache({ status: 500, type: "basic", redirected: false })).toBe(false);
    expect(sw.shouldCache({ status: 206, type: "basic", redirected: false })).toBe(false);
    expect(sw.shouldCache({ status: 200, type: "basic", redirected: true })).toBe(false);
    expect(sw.shouldCache({ status: 200, type: "cors", redirected: false })).toBe(false);
    expect(sw.shouldCache({ status: 0, type: "opaque", redirected: false })).toBe(false);
  });
});

describe("extractAssetUrls", () => {
  it("finds scripts and stylesheets in a page's HTML, once each", () => {
    const html = `<!DOCTYPE html><html><head>
      <link rel="stylesheet" href="/_next/static/css/a1b2.css" data-precedence="next"/>
      <link rel="preload" as="script" href="/_next/static/chunks/webpack-77.js"/>
      </head><body>
      <script src="/_next/static/chunks/webpack-77.js" async=""></script>
      <script src='/_next/static/chunks/app/page-9f.js' async></script>
      </body></html>`;
    expect(sw.extractAssetUrls(html)).toEqual([
      "/_next/static/css/a1b2.css",
      "/_next/static/chunks/webpack-77.js",
      "/_next/static/chunks/app/page-9f.js",
    ]);
  });

  it("also finds files mentioned inside Next.js's escaped data in <script> tags", () => {
    const html = `<script>self.__next_f.push([1,"2:I[\\"/_next/static/chunks/42-abc.js\\",\\"/_next/static/chunks/app/layout-de.js\\"]"])</script>`;
    expect(sw.extractAssetUrls(html)).toEqual(["/_next/static/chunks/42-abc.js", "/_next/static/chunks/app/layout-de.js"]);
  });

  it("adds the missing /_next/ to the short 'static/chunks/...' form Next.js also uses", () => {
    const html = `<script>self.__next_f.push([1,"5:[\\"static/chunks/1d-3z.js\\",\\"/_next/static/chunks/1d-3z.js\\"]"])</script>`;
    expect(sw.extractAssetUrls(html)).toEqual(["/_next/static/chunks/1d-3z.js"]);
  });

  it("keeps the ?version part some hosts add to file names", () => {
    expect(sw.extractAssetUrls(`<script src="/_next/static/chunks/main.js?dpl=dpl_123"></script>`)).toEqual([
      "/_next/static/chunks/main.js?dpl=dpl_123",
    ]);
  });

  it("returns nothing for a page without built files", () => {
    expect(sw.extractAssetUrls("<p>hello</p>")).toEqual([]);
  });
});

describe("cachesToDelete", () => {
  it("deletes only OUR caches from older versions", () => {
    const keep = [sw.PAGES_CACHE, sw.STATIC_CACHE];
    const existing = [...keep, "wellbeing-pages-v0", "wellbeing-static-v0", "someone-elses-cache"];
    expect(sw.cachesToDelete(existing, keep)).toEqual(["wellbeing-pages-v0", "wellbeing-static-v0"]);
  });

  it("deletes nothing when everything is current", () => {
    const keep = [sw.PAGES_CACHE, sw.STATIC_CACHE];
    expect(sw.cachesToDelete(keep, keep)).toEqual([]);
  });
});

describe("app shell", () => {
  it("saves the offline page and the home page in advance", () => {
    expect(sw.APP_SHELL).toContain(sw.OFFLINE_PAGE);
    expect(sw.APP_SHELL).toContain("/");
  });

  it("saves the daily check-in and the habits page in advance, so they open offline (Stage 2)", () => {
    expect(sw.APP_SHELL).toContain("/checkin");
    expect(sw.APP_SHELL).toContain("/habits");
  });

  it("saves the streaks and breathing pages in advance too (Stage 3)", () => {
    expect(sw.APP_SHELL).toContain("/streaks");
    expect(sw.APP_SHELL).toContain("/breathe");
  });

  it("saves the friends page in advance too (Stage 4)", () => {
    expect(sw.APP_SHELL).toContain("/friends");
  });

  it("saves the insights and privacy pages in advance too (Stage 5)", () => {
    expect(sw.APP_SHELL).toContain("/insights");
    expect(sw.APP_SHELL).toContain("/privacy");
  });

  it("only lists pages that really exist (a typo would make the whole install fail)", () => {
    const pages = sw.APP_SHELL.filter((path) => !path.startsWith("/icons/") && !path.includes("."));
    for (const path of pages) {
      // "/" is app/page.tsx, "/streaks" is app/streaks/page.tsx.
      expect(existsSync(join(__dirname, "..", "..", "app", path, "page.tsx")), path).toBe(true);
    }
  });

  it("only lists pages and files the strategy would actually serve", () => {
    for (const path of sw.APP_SHELL) {
      expect(sw.chooseStrategy(req(path), APP)).not.toBe("skip");
    }
  });

  it("listens to the three events a caching service worker needs", () => {
    expect([...sw.listenedEvents].sort()).toEqual(["activate", "fetch", "install"]);
  });
});
