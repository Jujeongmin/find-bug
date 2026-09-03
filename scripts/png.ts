/**
 * The smallest PNG codec that reads the sheets in this repo and writes new
 * ones: 8-bit RGBA in, 8-bit RGBA out.
 *
 * Node ships zlib and no image codec. Two scripts need one — the palette swap
 * that builds the townspeople and the drawing script that builds the office
 * furniture — and a dependency for two scripts run by hand is the larger cost.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

export interface Image {
  w: number;
  h: number;
  /** RGBA, one byte per channel */
  data: Buffer;
}

export function blank(w: number, h: number): Image {
  return { w, h, data: Buffer.alloc(w * h * 4) };
}

export function decode(path: string): Image {
  const b = readFileSync(path);
  const w = b.readUInt32BE(16);
  const h = b.readUInt32BE(20);
  if (b[24] !== 8 || b[25] !== 6) {
    throw new Error(
      `${path}: expected 8-bit RGBA, got depth ${b[24]} type ${b[25]}`
    );
  }
  let o = 8;
  const idat: Buffer[] = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o);
    if (b.toString("ascii", o + 4, o + 8) === "IDAT") {
      idat.push(b.subarray(o + 8, o + 8 + len));
    }
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride);
    p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y
      ? out.subarray((y - 1) * stride, y * stride)
      : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const up = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += up;
      else if (filter === 3) v += (a + up) >> 1;
      else if (filter === 4) {
        const guess = a + up - c;
        const da = Math.abs(guess - a);
        const db = Math.abs(guess - up);
        const dc = Math.abs(guess - c);
        v += da <= db && da <= dc ? a : db <= dc ? up : c;
      }
      cur[x] = v & 255;
    }
  }
  return { w, h, data: out };
}

const CRC = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) c = table[(c ^ byte) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

export function encode(path: string, img: Image) {
  const stride = img.w * 4;
  // every row unfiltered: these are tens of kilobytes, and a filter chosen
  // badly costs more to debug than the bytes are worth
  const raw = Buffer.alloc(img.h * (stride + 1));
  for (let y = 0; y < img.h; y++) {
    raw[y * (stride + 1)] = 0;
    img.data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const chunk = (type: string, body: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const t = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(CRC(Buffer.concat([t, body])));
    return Buffer.concat([len, t, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ])
  );
}

/** one pixel, in #rrggbb; anything off the image is dropped */
export function put(img: Image, x: number, y: number, hex: string) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const i = (y * img.w + x) * 4;
  img.data[i] = parseInt(hex.slice(1, 3), 16);
  img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
  img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
  img.data[i + 3] = 255;
}

export function rect(
  img: Image,
  x: number,
  y: number,
  w: number,
  h: number,
  hex: string
) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(img, x + i, y + j, hex);
}

/** a filled rectangle with a one-pixel border in another colour */
export function box(
  img: Image,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  edge: string
) {
  rect(img, x, y, w, h, edge);
  rect(img, x + 1, y + 1, w - 2, h - 2, fill);
}
