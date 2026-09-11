/**
 * How far above its own position a character sheet draws its feet.
 *
 * An entity is placed by its bottom edge: `top: y` with a -100% transform, so
 * `y` is the bottom of the frame. The art inside the frame does not reach that
 * edge — Puny Characters draws a 14px person in the middle of a 32px canvas —
 * so the feet you see are drawn some way above the point the game is actually
 * using for collision and for y-sorting.
 *
 * On the walk that is 13.5 display pixels, which is most of a brick course. It
 * is why the house read as something the player could stand on top of: they
 * stop correctly at the bottom edge of the wall, and are drawn a foot inside
 * it.
 *
 * This measures the gap rather than guessing it: decode the sheet, find the
 * lowest opaque pixel across every frame the animation actually shows, and
 * report the empty rows under it. Taking the lowest across all frames and not
 * the average is deliberate — the pad has to be the ground line, so a frame
 * with a raised knee does not make the character bob.
 *
 * Run: npx tsx scripts/footpad.ts
 */
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { FOOT_PAD, type SheetId } from "../src/engine/sheets";

interface Image {
  w: number;
  h: number;
  data: Buffer;
}

/**
 * Enough PNG to read an alpha channel.
 *
 * recolor.ts only ever had to read the worker sheet, which is straight RGBA.
 * The platformer characters are a palette image with a tRNS table, so this
 * also has to expand indexed colour — the whole question here is which pixels
 * are transparent, and in a palette image that lives in the palette.
 */
function decode(path: string): Image {
  const b = readFileSync(path);
  const w = b.readUInt32BE(16);
  const h = b.readUInt32BE(20);
  const depth = b[24];
  const type = b[25];
  if (depth !== 8 || (type !== 6 && type !== 3)) {
    throw new Error(`${path}: expected 8-bit RGBA or palette, got depth ${depth} type ${type}`);
  }
  let o = 8;
  const idat: Buffer[] = [];
  let plte = Buffer.alloc(0);
  let trns = Buffer.alloc(0);
  while (o < b.length) {
    const len = b.readUInt32BE(o);
    const name = b.toString("ascii", o + 4, o + 8);
    if (name === "IDAT") idat.push(b.subarray(o + 8, o + 8 + len));
    else if (name === "PLTE") plte = b.subarray(o + 8, o + 8 + len);
    else if (name === "tRNS") trns = b.subarray(o + 8, o + 8 + len);
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = type === 6 ? 4 : 1;
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
  if (type === 6) return { w, h, data: out };
  /* palette: expand to RGBA so the reader only ever deals with one layout.
     A palette entry with no tRNS byte is fully opaque, which is the spec. */
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const idx = out[i];
    rgba[i * 4] = plte[idx * 3] ?? 0;
    rgba[i * 4 + 1] = plte[idx * 3 + 1] ?? 0;
    rgba[i * 4 + 2] = plte[idx * 3 + 2] ?? 0;
    rgba[i * 4 + 3] = idx < trns.length ? trns[idx] : 255;
  }
  return { w, h, data: rgba };
}

/** anything this faint is a stray edge pixel rather than the character */
const OPAQUE = 20;

/** the lowest row of one frame that has any of the character in it */
function lastRow(
  img: Image,
  tile: number,
  margin: number,
  col: number,
  row: number
): number {
  const x0 = col * (tile + margin);
  const y0 = row * (tile + margin);
  for (let y = tile - 1; y >= 0; y--) {
    for (let x = 0; x < tile; x++) {
      if (img.data[((y0 + y) * img.w + x0 + x) * 4 + 3] > OPAQUE) return y;
    }
  }
  return -1;
}

interface Sheet {
  id: SheetId;
  tile: number;
  margin: number;
  /** every frame the game shows, as [col, row] */
  frames: [number, number][];
  scale: number;
}

/* The two sheets a player is ever drawn from. Both listed with the frames the
   scenes actually use: the walk's actor cycles idle plus four columns across
   all eight facing rows, the platformer's player is a single still cell. */
const WORKER_FRAMES: [number, number][] = [];
for (let row = 0; row < 8; row++) {
  for (const col of [0, 1, 2, 3, 4]) WORKER_FRAMES.push([col, row]);
}

const PEOPLE: SheetId[] = ["worker", "worker2", "personA", "personB", "personC"];

const MEASURED: Sheet[] = [
  ...PEOPLE.map((id) => ({
    id,
    tile: 32,
    margin: 0,
    frames: WORKER_FRAMES,
    scale: 1.5,
  })),
  /* the platformer's player, for the same question asked of the other half of
     the game: it is a single still cell and it is drawn on its own feet */
  { id: "platchars", tile: 24, margin: 0, frames: [[0, 1]], scale: 1.9 },
];

let bad = 0;
const fail = (m: string) => {
  console.log(`FAIL ${m}`);
  bad++;
};

for (const s of MEASURED) {
  const img = decode(`src/assets/sheets/${s.id}.png`);
  let lowest = -1;
  let highest = s.tile;
  for (const [col, row] of s.frames) {
    const r = lastRow(img, s.tile, s.margin, col, row);
    if (r < 0) {
      fail(`${s.id} frame ${col},${row} is empty`);
      continue;
    }
    lowest = Math.max(lowest, r);
    highest = Math.min(highest, r);
  }
  const pad = s.tile - 1 - lowest;
  const bob = lowest - highest;
  const declared = FOOT_PAD[s.id] ?? 0;
  console.log(
    `${s.id}: tile ${s.tile}, ground row ${lowest}, empty rows below ${pad}` +
      `, foot travel ${bob}, at scale ${s.scale} that is ${(pad * s.scale).toFixed(1)}px`
  );
  if (declared !== pad) {
    fail(
      `${s.id}: sheets.ts declares FOOT_PAD ${declared}, the art measures ${pad}`
    );
  }
  /* A sheet whose feet move between frames cannot be pinned by one number.
     None of ours do by more than a pixel — say so, rather than find out in a
     bug report that the character bobs. */
  if (bob > 1) {
    fail(`${s.id}: feet move ${bob} rows across the cycle, so one pad will bob`);
  }
}

/* Nothing may claim a pad the measurement did not produce: a stale entry here
   moves a character off its own position, which is the fault being fixed. */
for (const id of Object.keys(FOOT_PAD) as SheetId[]) {
  if (!MEASURED.some((s) => s.id === id)) {
    fail(`sheets.ts declares FOOT_PAD for ${id}, which this script never measures`);
  }
}

console.log(bad ? `${bad} FAIL` : "foot padding matches the art");
process.exitCode = bad ? 1 : 0;
