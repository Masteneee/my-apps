// Draws the extension icon and saves it as PNG files in icons/.
// Run it with:  node scripts/make-icons.js
// Only needed when you change the design: the PNGs are committed, and Chrome
// uses those. No library needed: Node's built-in `zlib` compresses the pixels,
// and we write the few bytes of the PNG format by hand.
//
// Design: a green rounded square, a white upright "phone video" frame (the
// shape of a short video), and two green pause bars inside it. The idea is
// "short videos on pause", a calm message rather than a red "forbidden" sign.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZES = [16, 32, 48, 128];
const GREEN = [4, 120, 87]; // #047857, the same green as the popup
const WHITE = [255, 255, 255];

// Distance from point (x, y) to a rounded rectangle: negative inside, positive
// outside. Coordinates go from 0 to 1, so one function works for every size.
function roundedRectDistance(x, y, centerX, centerY, halfWidth, halfHeight, radius) {
  const dx = Math.abs(x - centerX) - (halfWidth - radius);
  const dy = Math.abs(y - centerY) - (halfHeight - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside - radius;
}

// Which color (or transparent) the design has at one exact point.
function colorAt(x, y) {
  if (roundedRectDistance(x, y, 0.5, 0.5, 0.5, 0.5, 0.22) > 0) return null; // corner: see-through
  const insidePhone = roundedRectDistance(x, y, 0.5, 0.5, 0.21, 0.34, 0.07) <= 0;
  if (!insidePhone) return GREEN;
  const insideLeftBar = roundedRectDistance(x, y, 0.43, 0.5, 0.035, 0.12, 0.02) <= 0;
  const insideRightBar = roundedRectDistance(x, y, 0.57, 0.5, 0.035, 0.12, 0.02) <= 0;
  return insideLeftBar || insideRightBar ? GREEN : WHITE;
}

// Each pixel averages 4x4 points inside it ("supersampling"), so edges are
// smooth instead of jagged, which matters a lot at 16x16.
function drawIcon(size) {
  const samples = 4;
  const pixels = Buffer.alloc(size * size * 4); // red, green, blue, alpha per pixel
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, covered = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const color = colorAt((px + (sx + 0.5) / samples) / size, (py + (sy + 0.5) / samples) / size);
          if (!color) continue;
          r += color[0]; g += color[1]; b += color[2]; covered++;
        }
      }
      const i = (py * size + px) * 4;
      if (covered > 0) {
        pixels[i] = Math.round(r / covered);
        pixels[i + 1] = Math.round(g / covered);
        pixels[i + 2] = Math.round(b / covered);
      }
      pixels[i + 3] = Math.round((covered / (samples * samples)) * 255);
    }
  }
  return pixels;
}

// PNG checksums (CRC-32), computed the standard way.
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

// A PNG is a signature followed by "chunks": length, 4-letter type, data, checksum.
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); // width
  header.writeUInt32BE(size, 4); // height
  header[8] = 8; // 8 bits per color channel
  header[9] = 6; // color type 6 = red, green, blue + alpha (transparency)
  // bytes 10-12 stay 0: standard compression, filter and no interlacing
  // Each row starts with a "filter" byte; 0 means "no filter", the simplest.
  const rows = [];
  for (let y = 0; y < size; y++) {
    rows.push(Buffer.from([0]), pixels.subarray(y * size * 4, (y + 1) * size * 4));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // "this is a PNG"
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const size of SIZES) {
  const file = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(file, encodePng(size, drawIcon(size)));
  console.log('wrote', path.relative(process.cwd(), file));
}
