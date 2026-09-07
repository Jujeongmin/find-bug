/**
 * Store art: the square thumbnail and the shop item's picture.
 *
 * Drawn here for the same reason the office furniture is (scripts/officeart.ts):
 * no pack in the repo has these, and a store listing whose art was made
 * somewhere else looks like a different game to anyone who clicks it. Same
 * palette, same one-pixel outline weight, same blocky vocabulary as everything
 * the player is about to see.
 *
 * Both are drawn small and scaled up by whole numbers, so every edge lands on a
 * pixel boundary and nothing is blurred on the way to 1024.
 *
 *   npm run storeart
 */
import { blank, encode, rect, put, type Image } from "./png";
import { mkdirSync } from "node:fs";

/* the game's own colours, lifted from App.css and officeart.ts */
const BG = "#161a24";
const BG_LO = "#101219";
const EDGE = "#0b0d12";
const AMBER = "#e0a03f";
const AMBER_LO = "#a9762a";
const CREAM = "#e8d5a8";
const RED = "#d8483c";
const RED_LO = "#8f2f26";
const CASE = "#d8d2c0";
const CASE_DARK = "#b3ad9b";
const SCREEN = "#2b6f77";
const SCREEN_LO = "#1d4f56";
const DESK = "#8a5f38";
const DESK_TOP = "#a9784a";
const GRASS = "#4f7a44";
const GRASS_LO = "#3c5e34";

/** nearest-neighbour upscale by a whole number, so nothing is smoothed */
function scale(src: Image, by: number): Image {
  const out = blank(src.w * by, src.h * by);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      for (let j = 0; j < by; j++) {
        for (let k = 0; k < by; k++) {
          const o = ((y * by + j) * out.w + (x * by + k)) * 4;
          src.data.copy(out.data, o, i, i + 4);
        }
      }
    }
  }
  return out;
}

/** a filled disc, by the usual squared-radius test */
function disc(img: Image, cx: number, cy: number, r: number, hex: string) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) put(img, cx + x, cy + y, hex);
    }
  }
}

/** a ring: the disc minus a smaller one, which is how a circle gets a weight */
function ring(
  img: Image,
  cx: number,
  cy: number,
  r: number,
  weight: number,
  hex: string
) {
  const inner = (r - weight) * (r - weight);
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (d <= r * r && d > inner) put(img, cx + x, cy + y, hex);
    }
  }
}

/**
 * A right-pointing triangle: tall at its left edge, one pixel at its tip.
 *
 * The height has to shrink as the column advances. Taking the smaller of the
 * distances to either end instead grows it and then shrinks it again, which is
 * a diamond — correct for a rhombus, useless for a play mark.
 */
function triangle(img: Image, x: number, y: number, h: number, hex: string) {
  const w = h >> 1;
  for (let j = 0; j < w; j++) {
    const tall = h - 2 * j;
    rect(img, x + j, y + j, 1, tall, hex);
  }
}

/** width of the triangle `triangle` draws for a given height */
const triW = (h: number) => h >> 1;

/* ------------------------------------------------------------------ *
 * thumbnail — a build on a monitor with one thing wrong on it
 *
 * The whole game in one picture: a little scene, and a red ring around the
 * part of it that is broken. The defect drawn is the first one the player
 * ever meets, a thing floating that should have fallen.
 * ------------------------------------------------------------------ */
function thumbnail(): Image {
  const S = 128;
  const img = blank(S, S);

  rect(img, 0, 0, S, S, BG);
  // a lighter panel behind the monitor, so the edges of the frame read
  rect(img, 0, 0, S, 96, BG_LO);

  /* monitor: case, then the glass inside it */
  const mx = 10;
  const my = 10;
  const mw = 108;
  const mh = 72;
  rect(img, mx - 2, my - 2, mw + 4, mh + 4, EDGE);
  rect(img, mx, my, mw, mh, CASE);
  rect(img, mx, my + mh - 6, mw, 6, CASE_DARK);

  const sx = mx + 6;
  const sy = my + 6;
  const sw = mw - 12;
  const sh = mh - 18;
  rect(img, sx, sy, sw, sh, SCREEN_LO);
  rect(img, sx, sy, sw, sh - 3, SCREEN);

  /* the scene on the glass: ground, two blocks standing on it, one floating */
  const gy = sy + sh - 10;
  rect(img, sx, gy, sw, 10, GRASS_LO);
  rect(img, sx, gy, sw, 3, GRASS);

  // two that behave: sitting on the ground
  rect(img, sx + 10, gy - 9, 9, 9, DESK);
  rect(img, sx + 10, gy - 9, 9, 2, DESK_TOP);
  rect(img, sx + 24, gy - 9, 9, 9, DESK);
  rect(img, sx + 24, gy - 9, 9, 2, DESK_TOP);

  // the defect: the same block, hanging in the air with nothing under it
  const bx = sx + 42;
  const by = gy - 20;
  rect(img, bx, by, 9, 9, DESK);
  rect(img, bx, by, 9, 2, DESK_TOP);

  // the ring that says "this one" — drawn twice for a dark outer edge
  ring(img, bx + 4, by + 4, 13, 3, RED_LO);
  ring(img, bx + 4, by + 4, 12, 2, RED);

  /* monitor stand and the desk it is standing on */
  rect(img, mx + mw / 2 - 6, my + mh + 2, 12, 6, CASE_DARK);
  rect(img, mx + mw / 2 - 14, my + mh + 8, 28, 4, CASE);
  rect(img, mx + mw / 2 - 14, my + mh + 8, 28, 1, EDGE);

  rect(img, 0, 96, S, 4, EDGE);
  rect(img, 0, 100, S, S - 100, DESK);
  rect(img, 0, 100, S, 5, DESK_TOP);

  /* a mug on the desk, because the clock and the coffee are the other half
     of the game and the picture should not be only the screen */
  rect(img, 96, 104, 12, 13, CREAM);
  rect(img, 96, 104, 12, 3, "#ffffff");
  rect(img, 99, 107, 6, 4, "#6b4630");
  rect(img, 108, 107, 3, 6, CREAM);
  rect(img, 109, 108, 1, 4, DESK);

  /* three amber pips at bottom-left: the condition meter, which is the other
     thing the player is always reading */
  for (let i = 0; i < 3; i++) disc(img, 12 + i * 11, 114, 4, AMBER);
  disc(img, 45, 114, 4, AMBER_LO);

  return scale(img, 8); // 1024x1024
}

/* ------------------------------------------------------------------ *
 * shop item — skip the ads
 *
 * What is sold is the wait, so the picture is a wait being skipped: the
 * universal skip glyph, over a clock that is not going to be watched.
 * ------------------------------------------------------------------ */
function removeAds(): Image {
  const S = 64;
  const img = blank(S, S);

  rect(img, 0, 0, S, S, BG);
  // a plate, so the glyph is not floating on flat dark
  disc(img, 32, 28, 27, "#1e2331");
  ring(img, 32, 28, 27, 1, "#2b3346");

  /*
   * Skip to the end: two triangles and the bar they run into. No clock behind
   * it — a clock face and a play mark at this size are two glyphs fighting over
   * the same twenty pixels, and the one that loses takes the other with it.
   */
  const h = 26;
  const w = triW(h);
  const gap = 1;
  const bar = 3;
  const total = w * 2 + gap + bar + 1;
  const gx = 32 - (total >> 1);
  const gy = 25 - (h >> 1);

  // a dark copy a pixel out on each side, the same outline the sprites carry
  triangle(img, gx - 1, gy - 1, h + 2, EDGE);
  triangle(img, gx + w + gap - 1, gy - 1, h + 2, EDGE);
  rect(img, gx + w * 2 + gap + 1 - 1, gy - 1, bar + 2, h + 2, EDGE);

  triangle(img, gx, gy, h, AMBER);
  triangle(img, gx + w + gap, gy, h, AMBER);
  rect(img, gx + w * 2 + gap + 1, gy, bar, h, AMBER);

  /* the mug below: what the skip actually hands over */
  rect(img, 25, 44, 12, 12, EDGE);
  rect(img, 26, 45, 10, 10, CREAM);
  rect(img, 26, 45, 10, 2, "#ffffff");
  rect(img, 28, 48, 6, 4, "#6b4630");
  rect(img, 37, 47, 3, 6, EDGE);
  rect(img, 37, 48, 2, 4, CREAM);

  return scale(img, 8); // 512x512
}

mkdirSync("docs/store", { recursive: true });

const thumb = thumbnail();
encode("docs/store/thumbnail.png", thumb);
console.log(`wrote docs/store/thumbnail.png (${thumb.w}x${thumb.h})`);

const item = removeAds();
encode("docs/store/remove-ads.png", item);
console.log(`wrote docs/store/remove-ads.png (${item.w}x${item.h})`);
