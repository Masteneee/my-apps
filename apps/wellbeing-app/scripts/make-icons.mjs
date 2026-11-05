// Draws the app icons as PNG files, with no extra library.
// Run it with `npm run icons` after changing the colours or sizes below.
// The PNGs it writes are committed, so you only need this to change the icon.
//
// The design: a calm sage square with a soft "breathing" circle and ring.
//
// How a PNG is made (simplified): a list of pixels (red, green, blue, alpha),
// squeezed with zlib (the same compression as .zip files), wrapped in a few
// labelled "chunks" (IHDR = size, IDAT = pixels, IEND = the end).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");

// Keep in sync with --accent and --page in app/globals.css.
const BACKGROUND = [79, 125, 107]; // #4f7d6b (sage)
const FOREGROUND = [247, 246, 243]; // #f7f6f3 (warm off-white)

/**
 * How much of the pixel at (x, y) each shape covers, from 0 to 1.
 * All sizes are fractions of the icon, so every size looks the same.
 * `rounded` = rounded corners (for normal icons). Maskable icons are full
 * squares because Android cuts its own shape (circle, squircle...) out of them.
 */
function shade(x, y, size, rounded) {
  const cx = x / size - 0.5; // -0.5 .. 0.5, 0 is the middle
  const cy = y / size - 0.5;
  const distance = Math.hypot(cx, cy);

  // Background: inside the square, minus the rounded corners if asked.
  let inBackground = true;
  if (rounded) {
    const radius = 0.22;
    const qx = Math.max(Math.abs(cx) - (0.5 - radius), 0);
    const qy = Math.max(Math.abs(cy) - (0.5 - radius), 0);
    inBackground = Math.hypot(qx, qy) <= radius;
  }

  // Everything stays inside the middle 80% ("safe zone" of maskable icons),
  // so Android's mask never cuts it.
  const inDot = distance <= 0.17;
  const inRing = distance >= 0.27 && distance <= 0.305;
  return { inBackground, inForeground: inDot || inRing };
}

function drawIcon(size, rounded) {
  // 4 x 4 samples per pixel, averaged: smooth edges instead of jagged steps
  // ("anti-aliasing").
  const samples = 4;
  const rowLength = 1 + size * 4; // each row starts with a "filter type" byte (0 = none)
  const pixels = Buffer.alloc(rowLength * size);

  for (let y = 0; y < size; y++) {
    pixels[y * rowLength] = 0;
    for (let x = 0; x < size; x++) {
      let background = 0;
      let foreground = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const hit = shade(x + (sx + 0.5) / samples, y + (sy + 0.5) / samples, size, rounded);
          if (hit.inBackground) background++;
          if (hit.inBackground && hit.inForeground) foreground++;
        }
      }
      const total = samples * samples;
      const mix = background ? foreground / background : 0; // share of foreground colour
      const offset = y * rowLength + 1 + x * 4;
      for (let channel = 0; channel < 3; channel++) {
        pixels[offset + channel] = Math.round(BACKGROUND[channel] * (1 - mix) + FOREGROUND[channel] * mix);
      }
      pixels[offset + 3] = Math.round((background / total) * 255); // alpha: transparent corners
    }
  }
  return encodePng(size, size, pixels);
}

// --- PNG file format -------------------------------------------------------

// CRC-32: a checksum PNG readers use to detect damaged files.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // 8 bits per channel
  header[9] = 6; // colour type 6 = RGBA
  // bytes 10-12 stay 0: standard compression, filter and no interlacing
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // the PNG "signature"
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- The files we need -----------------------------------------------------

const ICONS = [
  // Listed in app/manifest.ts (Android, desktop install).
  { file: "public/icons/icon-192.png", size: 192, rounded: true },
  { file: "public/icons/icon-512.png", size: 512, rounded: true },
  { file: "public/icons/icon-maskable-512.png", size: 512, rounded: false },
  // iPhone home screen. iOS rounds the corners itself, so a full square.
  // Next.js turns app/apple-icon.png into <link rel="apple-touch-icon"> by itself.
  { file: "app/apple-icon.png", size: 180, rounded: false },
];

for (const { file, size, rounded } of ICONS) {
  const path = join(appDir, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, drawIcon(size, rounded));
  console.log(`wrote ${file} (${size}x${size})`);
}
