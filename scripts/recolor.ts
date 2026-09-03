/**
 * Builds the townspeople out of the one worker sprite we have.
 *
 * The street had three passers-by and one character sheet, so they were the
 * same person under a CSS hue-rotate. Rotating the hue of a whole sprite turns
 * the skin and the hair with the shirt, which does not make another person —
 * it makes the same person under a different coloured light, and three of them
 * on one pavement read as a rendering fault rather than as a crowd.
 *
 * This remaps the palette instead, one ramp at a time: shirt, trousers and
 * hair are separate runs of colour in the art, so they can be given separate
 * new ones and the outline, the eyes and the skin left alone. The result is a
 * real sheet per person, so nothing at runtime has to filter anything.
 *
 * Run: npm run recolor
 *
 * CC0 in, CC0 out: the source is Puny Characters, and a palette swap of a
 * public domain sprite is still public domain. See docs/ASSETS.md.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

const SRC = "src/assets/sheets/worker.png";
const OUT = (id: string) => `src/assets/sheets/${id}.png`;

/* ---------- the ramps, as they are drawn in the source ---------- */

/** teal work shirt: lit, mid, shadow */
const SHIRT = ["#007966", "#004f43", "#002e27"];
/** khaki trousers, lightest to darkest */
const TROUSERS = ["#dcb05c", "#c99236", "#aa7a18", "#5d4717", "#3f3013"];
/** brown hair */
const HAIR = ["#8c4d2b", "#754227", "#51301e"];
/** skin, lit to shadow */
const SKIN = ["#f7d099", "#f6a954", "#d97f40", "#aa5a33"];

interface Person {
  id: string;
  shirt: string[];
  trousers: string[];
  hair: string[];
  /** left alone unless the person is meant to look different in the face */
  skin?: string[];
}

/**
 * Three people who are not each other.
 *
 * Each is one shirt, one pair of trousers and one head of hair away from the
 * source, which is as far as a palette swap can honestly go — the silhouette
 * is the same in all of them, and that is fine for somebody you pass on the
 * way to work and say six words to.
 */
const PEOPLE: Person[] = [
  {
    // the one who is always ahead of you at the crossing
    id: "personA",
    shirt: ["#4a6da8", "#2f4a78", "#1a2b47"],
    trousers: ["#d2d6dc", "#adb2ba", "#8b9099", "#4f545b", "#33363a"],
    hair: ["#4a423c", "#332e2a", "#1f1c1a"],
  },
  {
    // the one who is always on the phone
    id: "personB",
    shirt: ["#a85050", "#7d3535", "#4c1f1f"],
    trousers: ["#7fa3c9", "#5b81a8", "#45658a", "#2c405a", "#1e2c3e"],
    hair: ["#e2bd6c", "#c39640", "#8f6b26"],
  },
  {
    // the neighbour, out on the step
    id: "personC",
    shirt: ["#74903f", "#52692b", "#34431b"],
    trousers: ["#9c7a52", "#7a5c3b", "#5f462c", "#3d2c1b", "#2a1e12"],
    hair: ["#a8482b", "#803320", "#582115"],
    skin: ["#e0b184", "#c68d5a", "#a4663a", "#7a4726"],
  },
];

/* ---------- png, in and out ---------- */

interface Image {
  w: number;
  h: number;
  /** RGBA, one byte per channel */
  data: Buffer;
}

/**
 * Decodes 8-bit RGBA PNGs and nothing else, which is what the sheets are.
 * Node ships zlib but no image codec, and the alternative is a dependency for
 * one script that runs by hand.
 */
function decode(path: string): Image {
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

function encode(path: string, img: Image) {
  const stride = img.w * 4;
  // every row unfiltered: these are 30KB sheets, and a filter chosen badly
  // costs more to debug than the bytes are worth
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

/* ---------- the swap ---------- */

const rgb = (hex: string) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

function mapFor(p: Person): Map<string, number[]> {
  const m = new Map<string, number[]>();
  const ramp = (from: string[], to: string[]) => {
    if (from.length !== to.length) {
      throw new Error(`${p.id}: ramp of ${from.length} replaced by ${to.length}`);
    }
    from.forEach((hex, i) => m.set(hex.toLowerCase(), rgb(to[i])));
  };
  ramp(SHIRT, p.shirt);
  ramp(TROUSERS, p.trousers);
  ramp(HAIR, p.hair);
  if (p.skin) ramp(SKIN, p.skin);
  return m;
}

const src = decode(SRC);
for (const person of PEOPLE) {
  const map = mapFor(person);
  const data = Buffer.from(src.data);
  const hit = new Map<string, number>();
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const hex =
      "#" +
      [data[i], data[i + 1], data[i + 2]]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
    const to = map.get(hex);
    if (!to) continue;
    data[i] = to[0];
    data[i + 1] = to[1];
    data[i + 2] = to[2];
    hit.set(hex, (hit.get(hex) ?? 0) + 1);
  }
  /*
   * A ramp that matched nothing is the failure this script is prone to: the
   * source palette is written down here by hand, and one wrong digit produces
   * a sheet that looks like the original and is not obviously wrong until it
   * is standing on the pavement beside it.
   */
  const missed = [...map.keys()].filter((k) => !hit.has(k));
  if (missed.length) {
    throw new Error(`${person.id}: no pixels for ${missed.join(", ")}`);
  }
  encode(OUT(person.id), { ...src, data });
  const changed = [...hit.values()].reduce((a, b) => a + b, 0);
  console.log(`${person.id}: ${changed} pixels over ${hit.size} colours`);
}
