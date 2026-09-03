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
 * Output: src/assets/sheets/office.png — a 4x4 grid of 16px tiles.
 *
 *   (0,0)-(1,1)  desk, two tiles by two
 *   (2,0)        monitor, screen towards the player
 *   (3,0)        monitor from behind, for the developer's bench
 *   (2,1)        keyboard
 *   (3,1)        the seat, backrest towards the player
 *   (0,2)-(0,3)  bookshelf, one tile by two
 *   (1,2)-(1,3)  filing cabinet, one tile by two
 */
import { blank, box, encode, rect } from "./png";

const TILE = 16;
const COLS = 4;
const ROWS = 4;

/* the room's palette: warm wood, and a beige machine with a green screen */
const EDGE = "#3a2a1e";
const TOP = "#a9784a";
const TOP_LIT = "#bd8a58";
const FRONT = "#8a5f38";
const PANEL = "#79512f";
const DRAWER = "#946a41";
const KNOB = "#e6c887";
const LEG = "#5c4028";

const SEAT = "#4f5763";
const SEAT_LIT = "#657084";
const SEAT_EDGE = "#272c34";
const POST = "#9a958a";

const SHELF = "#8a6540";
const SHELF_LIT = "#a37b52";
const SHELF_DARK = "#5c4028";
const BOOKS = ["#b5483c", "#3f7fa8", "#d9a441", "#4f7a44", "#7a4f8f", "#c96a3a"];

const STEEL = "#b9bcc2";
const STEEL_LIT = "#d2d5da";
const STEEL_DARK = "#8d9096";
const STEEL_EDGE = "#43464b";
const LABEL = "#e8e5d8";

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

/* ---------- the seat, at (3,1), seen from behind ---------- */
{
  const x = 3 * TILE;
  const y = TILE;
  /*
   * The back of a chair, not the front of one.
   *
   * What faces the camera at a desk against the wall is the backrest, and the
   * front view would sit the worker down looking away from their screen. The
   * CSS one this replaces made the same choice for the same reason.
   */
  box(img, x + 3, y + 1, 10, 8, SEAT, SEAT_EDGE);
  rect(img, x + 4, y + 2, 8, 2, SEAT_LIT);
  // the seat itself, wider than the back and just visible under it
  box(img, x + 2, y + 8, 12, 4, SEAT, SEAT_EDGE);
  rect(img, x + 3, y + 9, 10, 1, SEAT_LIT);
  // post and the star base, with a caster on each visible arm
  rect(img, x + 7, y + 12, 2, 2, POST);
  rect(img, x + 4, y + 14, 8, 1, POST);
  rect(img, x + 3, y + 14, 1, 1, SEAT_EDGE);
  rect(img, x + 12, y + 14, 1, 1, SEAT_EDGE);
  rect(img, x + 7, y + 14, 2, 1, SEAT_EDGE);
}

/* ---------- the bookshelf, at (0,2), one tile by two ---------- */
{
  const x = 0;
  const y = 2 * TILE;
  box(img, x + 1, y + 2, 14, 29, SHELF, EDGE);
  rect(img, x + 2, y + 3, 12, 1, SHELF_LIT);
  // three shelves, and what is standing on each of them
  const shelves = [10, 18, 26];
  shelves.forEach((sy, row) => {
    rect(img, x + 2, y + sy, 12, 1, SHELF_DARK);
    // books lean along the shelf above the board, in a different order on each
    for (let i = 0; i < 5; i++) {
      const h = 5 - ((i + row) % 3);
      rect(img, x + 3 + i * 2, y + sy - h, 2, h, BOOKS[(i + row * 2) % BOOKS.length]);
    }
  });
  rect(img, x + 2, y + 30, 12, 1, SHELF_DARK);
}

/* ---------- the filing cabinet, at (1,2), one tile by two ---------- */
{
  const x = TILE;
  const y = 2 * TILE;
  box(img, x + 1, y + 4, 14, 27, STEEL, STEEL_EDGE);
  // the top, catching the light, and the shadow down the right side
  rect(img, x + 2, y + 5, 12, 2, STEEL_LIT);
  rect(img, x + 13, y + 7, 1, 23, STEEL_DARK);
  // three drawers, each with a handle and a label in its holder
  for (const dy of [9, 17, 25]) {
    box(img, x + 2, y + dy, 12, 6, STEEL, STEEL_EDGE);
    rect(img, x + 4, y + dy + 1, 4, 2, LABEL);
    rect(img, x + 9, y + dy + 2, 4, 1, STEEL_DARK);
  }
}

encode("src/assets/sheets/office.png", img);
console.log(`office.png: ${COLS}x${ROWS} tiles of ${TILE}px`);
