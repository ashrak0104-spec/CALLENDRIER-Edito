'use strict';

/**
 * Generates build/icon.png (256x256) and build/icon.ico (PNG-compressed 256px
 * entry) with zero dependencies, so electron-builder always has an icon.
 * Run: npm run icon
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SS = 4; // supersampling factor
const OUT = 256;
const W = OUT * SS;
const px = new Uint8Array(W * W * 4);

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function blend(x, y, rgb, alpha) {
  if (x < 0 || y < 0 || x >= W || y >= W) return;
  const a = clamp01(alpha);
  if (a <= 0) return;
  const i = (y * W + x) * 4;
  const da = px[i + 3] / 255;
  const oa = a + da * (1 - a);
  if (oa <= 0) return;
  for (let c = 0; c < 3; c += 1) {
    px[i + c] = Math.round((rgb[c] * a + px[i + c] * da * (1 - a)) / oa);
  }
  px[i + 3] = Math.round(oa * 255);
}

function insideRoundRect(x, y, rx, ry, w, h, r) {
  const cx = Math.min(Math.max(x, rx + r), rx + w - r);
  const cy = Math.min(Math.max(y, ry + r), ry + h - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function roundRect(x, y, w, h, r, rgb, alpha = 1) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(W, Math.ceil(y + h));
  for (let py = y0; py < y1; py += 1) {
    for (let pxl = x0; pxl < x1; pxl += 1) {
      if (insideRoundRect(pxl + 0.5, py + 0.5, x, y, w, h, r)) {
        blend(pxl, py, rgb, alpha);
      }
    }
  }
}

function circle(cx, cy, r, rgb, alpha = 1) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) blend(x, y, rgb, alpha);
    }
  }
}

/* Background: indigo → violet gradient inside a rounded square. */
for (let y = 0; y < W; y += 1) {
  for (let x = 0; x < W; x += 1) {
    if (!insideRoundRect(x + 0.5, y + 0.5, 0, 0, W, W, W * 0.22)) continue;
    const t = clamp01((x / W) * 0.45 + (y / W) * 0.65);
    const rgb = [
      Math.round(79 + (124 - 79) * t),
      Math.round(70 + (58 - 70) * t),
      Math.round(229 + (237 - 229) * t),
    ];
    blend(x, y, rgb, 1);
  }
}

/* Soft highlight in the top-left corner. */
circle(W * 0.24, W * 0.18, W * 0.3, [255, 255, 255], 0.07);

const S = W / 1024; // coordinates below are authored on a 1024 grid
const R = (v) => v * S;

/* Calendar body + header + binder rings. */
roundRect(R(186), R(232), R(652), R(600), R(96), [255, 255, 255], 1);
roundRect(R(186), R(232), R(652), R(160), R(96), [67, 56, 202], 1);
roundRect(R(186), R(310), R(652), R(82), 0, [67, 56, 202], 1);
roundRect(R(348), R(168), R(56), R(118), R(28), [49, 46, 129], 1);
roundRect(R(620), R(168), R(56), R(118), R(28), [49, 46, 129], 1);

/* Grid of dots: the month at a glance. */
const dotColors = [
  [129, 140, 248],
  [167, 139, 250],
  [99, 102, 241],
  [129, 140, 248],
  [99, 102, 241],
  [167, 139, 250],
  [167, 139, 250],
  [129, 140, 248],
  [99, 102, 241],
];
let n = 0;
for (let row = 0; row < 3; row += 1) {
  for (let col = 0; col < 3; col += 1) {
    circle(R(300 + col * 190), R(468 + row * 128), R(34), dotColors[n % dotColors.length], 0.95);
    n += 1;
  }
}

/* Downsample with a box filter for smooth edges. */
const size = OUT;
const out = Buffer.alloc(size * size * 4);
for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (let sy = 0; sy < SS; sy += 1) {
      for (let sx = 0; sx < SS; sx += 1) {
        const i = ((y * SS + sy) * W + (x * SS + sx)) * 4;
        const alpha = px[i + 3] / 255;
        r += px[i] * alpha;
        g += px[i + 1] * alpha;
        b += px[i + 2] * alpha;
        a += px[i + 3];
      }
    }
    const count = SS * SS;
    const alphaSum = a / 255;
    const o = (y * size + x) * 4;
    if (alphaSum > 0) {
      out[o] = Math.round(r / alphaSum);
      out[o + 1] = Math.round(g / alphaSum);
      out[o + 2] = Math.round(b / alphaSum);
    }
    out[o + 3] = Math.round(a / count);
  }
}

/* Minimal PNG encoder (RGBA, filter 0). */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const raw = Buffer.alloc(size * (size * 4 + 1));
for (let y = 0; y < size; y += 1) {
  raw[y * (size * 4 + 1)] = 0;
  out.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

/* ICO container with a single 256x256 PNG entry. */
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(1, 4);

const entry = Buffer.alloc(16);
entry[0] = 0; // width 256
entry[1] = 0; // height 256
entry[2] = 0;
entry[3] = 0;
entry.writeUInt16LE(1, 4); // color planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12); // data offset

const buildDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(buildDir, { recursive: true });
fs.writeFileSync(path.join(buildDir, 'icon.png'), png);
fs.writeFileSync(path.join(buildDir, 'icon.ico'), Buffer.concat([icoHeader, entry, png]));

console.log(
  `[icon] build/icon.png (${png.length} o) + build/icon.ico (${png.length + 22} o) générés.`,
);
