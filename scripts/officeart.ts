/**
 * Draws the office furniture, because no pack here has it.
 *
 * The QA floor needs a desk and a monitor seen from the front. Every sheet in
 * this repo was searched for both: the city pack is a city from above and has
 * no interiors; Roguelike Indoors is a tavern; Messy Furniture has sofas,
 * wardrobes and beds and not one screen. What the room had instead was a
 * fantasy writing desk and a monitor made of CSS gradients, which is the one
 * thing left in it that was not pixel art.
 *
 * So they are drawn here, in code rather than in a paint program, for the same
 * reason the chair back and the shop sign are CSS: the shapes are simple, and
 * a rectangle written down is a rectangle anyone can move a pixel later.
 *
 * Run: npm run officeart
 *
 * Output: src/assets/sheets/office.png — a 4x2 grid of 16px tiles.
 *
 *   (0,0)-(1,1)  desk, two tiles by two
 *   (2,0)        monitor, screen towards the player
 *   (3,0)        monitor from behind, for the developer's bench
 *   (2,1)        keyboard
 */
import { blank, box, encode, rect } from "./png";

const TILE = 16;
const COLS = 4;
const ROWS = 2;

/* the room's palette: warm wood, and a beige machine with a green screen */
const EDGE = "#3a2a1e";
const TOP = "#a9784a";
const TOP_LIT = "#bd8a58";
const FRONT = "#8a5f38";
const PANEL = "#79512f";
const DRAWER = "#946a41";
const KNOB = "#e6c887";
const LEG = "#5c4028";

const CASE = "#d8d2c0";
const CASE_DARK = "#b3ad9b";
const CASE_EDGE = "#4a463c";
const SCREEN = "#57c4b6";
const SCREEN_DARK = "#2f8a80";
const GLARE = "#b7ede4";
const BACK = "#c3bdab";

const img = blank(COLS * TILE, ROWS * TILE);

/* ---------- the desk, at (0,0), two tiles by two ---------- */
{
  const x = 0;
  const y = 0;
  // the slab, lit along its top edge and darker down its front face
  box(img, x, y + 6, 32, 9, TOP, EDGE);
  rect(img, x + 1, y + 7, 30, 2, TOP_LIT);
  rect(img, x + 1, y + 12, 30, 2, FRONT);
  // the panel under it, set in a pixel each side so the slab overhangs
  box(img, x + 2, y + 15, 28, 10, PANEL, EDGE);
  // two drawers on the right, which is the side the seat is not on
  for (const dy of [16, 21]) {
    box(img, x + 17, y + dy, 12, 4, DRAWER, EDGE);
    rect(img, x + 22, y + dy + 1, 2, 2, KNOB);
  }
  // legs
  rect(img, x + 3, y + 25, 3, 5, LEG);
  rect(img, x + 26, y + 25, 3, 5, LEG);
  rect(img, x + 3, y + 30, 3, 1, EDGE);
  rect(img, x + 26, y + 30, 3, 1, EDGE);
}

/* ---------- the monitor, at (2,0) ---------- */
{
  const x = 2 * TILE;
  const y = 0;
  // case
  box(img, x + 1, y + 1, 14, 11, CASE, CASE_EDGE);
  rect(img, x + 2, y + 10, 12, 1, CASE_DARK);
  // screen, with the light off the top-left corner of the glass
  box(img, x + 3, y + 3, 10, 6, SCREEN, CASE_EDGE);
  rect(img, x + 4, y + 7, 8, 1, SCREEN_DARK);
  rect(img, x + 4, y + 4, 2, 1, GLARE);
  rect(img, x + 4, y + 5, 1, 1, GLARE);
  // stand and foot
  rect(img, x + 6, y + 12, 4, 2, CASE_DARK);
  box(img, x + 4, y + 13, 8, 3, CASE, CASE_EDGE);
}

/* ---------- the same monitor from behind, at (3,0) ---------- */
{
  const x = 3 * TILE;
  const y = 0;
  box(img, x + 1, y + 1, 14, 11, BACK, CASE_EDGE);
  // vents, and the cable going down the back of the desk
  for (let i = 0; i < 4; i++) rect(img, x + 4, y + 3 + i * 2, 8, 1, CASE_DARK);
  rect(img, x + 7, y + 11, 2, 3, CASE_EDGE);
  rect(img, x + 6, y + 12, 4, 2, CASE_DARK);
  box(img, x + 4, y + 13, 8, 3, BACK, CASE_EDGE);
}

/* ---------- the keyboard, at (2,1) ---------- */
{
  const x = 2 * TILE;
  const y = TILE;
  box(img, x + 1, y + 8, 14, 6, CASE, CASE_EDGE);
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 6; i++) {
      rect(img, x + 3 + i * 2, y + 10 + row * 2, 1, 1, CASE_DARK);
    }
  }
}

encode("src/assets/sheets/office.png", img);
console.log(`office.png: ${COLS}x${ROWS} tiles of ${TILE}px`);
