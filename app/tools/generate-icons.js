/* One-off icon generator for NeuroNova PWA.
   Writes PNG app icons with no external dependencies (manual PNG encoder + zlib).
   Run: node app/tools/generate-icons.js */
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const OUT = path.join(__dirname, "..", "icons");
fs.mkdirSync(OUT, { recursive: true });

// CRC32
const CRC = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, pixelFn) {
  // raw scanlines: filter byte 0 + RGBA per pixel
  const raw = Buffer.alloc(size * (1 + size * 4));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size);
      raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = a;
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const lerp = (a, b, t) => Math.round(a + (b - a) * t);
const C1 = [109, 93, 252];   // brand purple
const C2 = [52, 225, 196];   // accent teal
const LIGHT = [236, 233, 255];
const BG = [14, 11, 30];     // app background (for opaque variants)

/**
 * @param opts.rounded  apply rounded-corner transparency
 * @param opts.opaque   fill outside-shape with solid BG instead of transparent
 * @param opts.pad      diamond scale (smaller = more safe-area padding, for maskable)
 */
function painter(opts) {
  return (x, y, size) => {
    const r = size * 0.22;          // corner radius
    const cx = size / 2, cy = size / 2;

    // diagonal gradient background
    const t = (x + y) / (2 * size);
    let col = [lerp(C1[0], C2[0], t), lerp(C1[1], C2[1], t), lerp(C1[2], C2[2], t)];

    // centered diamond (rhombus) mark
    const half = size * (opts.pad || 0.27);
    const dist = Math.abs(x - cx) / half + Math.abs(y - cy) / half;
    if (dist <= 1) {
      const glow = 1 - dist * 0.25;
      col = [lerp(col[0], LIGHT[0], glow), lerp(col[1], LIGHT[1], glow), lerp(col[2], LIGHT[2], glow)];
    }

    // rounded-corner / shape mask
    let inside = true;
    if (opts.rounded) {
      const dx = Math.max(0, Math.abs(x - cx) - (size / 2 - r));
      const dy = Math.max(0, Math.abs(y - cy) - (size / 2 - r));
      inside = dx * dx + dy * dy <= r * r;
    }
    if (!inside) return opts.opaque ? [BG[0], BG[1], BG[2], 255] : [0, 0, 0, 0];
    return [col[0], col[1], col[2], 255];
  };
}

const targets = [
  { file: "icon-192.png", size: 192, opts: { rounded: true } },
  { file: "icon-512.png", size: 512, opts: { rounded: true } },
  { file: "icon-maskable-512.png", size: 512, opts: { rounded: false, opaque: true, pad: 0.20 } },
  { file: "apple-touch-icon.png", size: 180, opts: { rounded: false, opaque: true } }
];

for (const t of targets) {
  fs.writeFileSync(path.join(OUT, t.file), encodePNG(t.size, painter(t.opts)));
  console.log("wrote icons/" + t.file);
}
console.log("done");
