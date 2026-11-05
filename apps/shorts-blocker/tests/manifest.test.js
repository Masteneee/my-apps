import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Chrome refuses to load the extension if manifest.json is broken or points
// to a file that doesn't exist, and the error is easy to miss. These checks
// catch that before you even open Chrome.

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const exists = (file) => fs.existsSync(path.join(root, file));

// A PNG stores its width and height at bytes 16 to 23 (inside the "IHDR" part).
function pngSize(file) {
  const bytes = fs.readFileSync(path.join(root, file));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('manifest.json', () => {
  it('is a Manifest V3 extension with a name and a version Chrome accepts', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBeTruthy();
    // Chrome versions are 1 to 4 numbers separated by dots.
    expect(manifest.version).toMatch(/^\d+(\.\d+){0,3}$/);
  });

  it('points only to files that exist', () => {
    const files = [
      manifest.action.default_popup,
      manifest.background.service_worker,
      ...Object.values(manifest.icons),
      ...Object.values(manifest.action.default_icon),
      ...manifest.content_scripts.flatMap((entry) => [...entry.js, ...(entry.css || [])]),
      ...manifest.web_accessible_resources.flatMap((entry) => entry.resources),
    ];
    for (const file of files) {
      expect(exists(file), `${file} is missing`).toBe(true);
    }
  });

  it('has every icon as a square PNG of the size its name says', () => {
    for (const [size, file] of Object.entries(manifest.icons)) {
      expect(pngSize(file)).toEqual({ width: Number(size), height: Number(size) });
    }
  });

  it('loads the shared files before each site script (order matters)', () => {
    for (const entry of manifest.content_scripts) {
      const siteScript = entry.js[entry.js.length - 1];
      expect(siteScript.startsWith('sites/')).toBe(true);
      expect(entry.js.indexOf('src/blocker-core.js')).toBe(entry.js.length - 2);
      expect(entry.js.indexOf('src/settings.js')).toBeLessThan(entry.js.indexOf('src/blocker-core.js'));
      expect(entry.js.indexOf('src/settings.js')).toBeGreaterThanOrEqual(0);
    }
  });

  it('only asks for the "storage" permission', () => {
    expect(manifest.permissions).toEqual(['storage']);
  });
});
