// Test helper: runs public/sw.js in a sandbox so tests can call its functions.
//
// Why a sandbox? sw.js is meant for the browser's service worker world, where
// `self`, `caches` and `fetch` exist. Node's built-in `vm` module runs the file
// in a fresh, separate "global scope" where we provide a fake `self` that just
// remembers which events the file listens to. Nothing touches a real network.
// This way we test the EXACT file the browser downloads, not a copy.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

export const SERVICE_WORKER_PATH = join(__dirname, "..", "..", "public", "sw.js");

export type StrategyRequest = { url: string; method: string; mode: string; isRsc: boolean };
export type Strategy = "skip" | "cache-first" | "network-first" | "page";

export type LoadedServiceWorker = {
  chooseStrategy(request: StrategyRequest, appOrigin: string): Strategy;
  shouldCache(response: { status: number; type: string; redirected: boolean }): boolean;
  extractAssetUrls(html: string): string[];
  cachesToDelete(existingNames: string[], keepNames: string[]): string[];
  /** Top-level constants of sw.js (they aren't functions, so we read them separately). */
  APP_SHELL: string[];
  OFFLINE_PAGE: string;
  PAGES_CACHE: string;
  STATIC_CACHE: string;
  /** Names of the events sw.js listens to ("install", "fetch"...). */
  listenedEvents: string[];
};

export function loadServiceWorker(): LoadedServiceWorker {
  const code = readFileSync(SERVICE_WORKER_PATH, "utf8");
  const listenedEvents: string[] = [];
  const sandbox = vm.createContext({
    URL,
    self: { addEventListener: (name: string) => listenedEvents.push(name) },
  });
  vm.runInContext(code, sandbox, { filename: "sw.js" });

  // `function` declarations become properties of the sandbox; `const` values
  // don't, so we ask the sandbox to evaluate their names.
  const read = <T>(name: string) => vm.runInContext(name, sandbox) as T;
  // JSON round trip: turns sandbox arrays into normal arrays for toEqual().
  const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));

  return {
    chooseStrategy: (request, origin) => read<LoadedServiceWorker["chooseStrategy"]>("chooseStrategy")(request, origin),
    shouldCache: (response) => read<LoadedServiceWorker["shouldCache"]>("shouldCache")(response),
    extractAssetUrls: (html) => plain(read<LoadedServiceWorker["extractAssetUrls"]>("extractAssetUrls")(html)),
    cachesToDelete: (names, keep) => plain(read<LoadedServiceWorker["cachesToDelete"]>("cachesToDelete")(names, keep)),
    APP_SHELL: plain(read<string[]>("APP_SHELL")),
    OFFLINE_PAGE: read<string>("OFFLINE_PAGE"),
    PAGES_CACHE: read<string>("PAGES_CACHE"),
    STATIC_CACHE: read<string>("STATIC_CACHE"),
    listenedEvents,
  };
}
