import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../../app/manifest";
import { loadServiceWorker } from "./load-service-worker";

const publicDir = join(__dirname, "..", "..", "public");

/** Reads the width and height written in a PNG file's header (bytes 16 to 23). */
function pngSize(path: string): string {
  const bytes = readFileSync(path);
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe("web app manifest", () => {
  const m = manifest();
  const icons = m.icons ?? [];

  it("has what browsers need to offer 'Install app'", () => {
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    // Chrome wants at least a 192px and a 512px icon.
    expect(icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it("points to icon files that exist and really have the size they claim", () => {
    for (const icon of icons) {
      const file = join(publicDir, icon.src);
      expect(existsSync(file), `${icon.src} is missing (run npm run icons)`).toBe(true);
      expect(pngSize(file)).toBe(icon.sizes);
    }
  });

  it("has every icon saved in advance by the service worker, so it shows offline", () => {
    const { APP_SHELL } = loadServiceWorker();
    for (const icon of icons) expect(APP_SHELL).toContain(icon.src);
    expect(APP_SHELL).toContain("/manifest.webmanifest");
  });
});
