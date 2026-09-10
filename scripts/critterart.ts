/**
 * Draws the wasp, because none of these packs has one.
 *
 * The herb field's two moving hazards are called 말벌 — hornets — in the goal
 * line and in the report list, and what was drawn for them was `platchars`
 * (4,1): a small yellow blob with two legs and no wings, which is the same
 * tile the card room used for a doll before that defect was dropped. The
 * player was told to watch out for wasps and shown something else.
 *
 * Every sheet in the repository was searched for an insect first — tinytown,
 * platformer, platchars, dungeon, roguelike, city, furniture. The nearest
 * thing to a flying pest anywhere in them is the platchars bat, and stage 3
 * already has both of those; a bat in a daylit herb field would be a second
 * wrong animal rather than the right one.
 *
 * So it is drawn here, in code, for the same reason the office furniture is:
 * the shapes are rectangles, and a rectangle written down is one anybody can
 * move a pixel later.
 *
 * Run: npm run critterart
 *
 * Output: src/assets/sheets/critter.png — one 16px tile.
 *
 *   (0,0)  wasp, flying to the right
 *
 * Drawn facing its direction of travel rather than symmetrically from above.
 * The patrol behaviour flips the sprite when it turns, and a symmetric insect
 * turns invisibly — the player would see it slide back and forth without ever
 * seeing it turn around.
 */
import { blank, encode, put, rect } from "./png";

const TILE = 16;
const COLS = 1;
const ROWS = 1;

/* a wasp is two colours and a hard black line, which is the whole point of it */
const DARK = "#241c12";
const BAND = "#f5c518";
const BAND_LIT = "#ffe066";
const SHELL = "#3a2c18";
const EYE = "#d8cdb8";
const WING = "#cfe0ef";
const WING_EDGE = "#8fa8bd";

const img = blank(TILE * COLS, TILE * ROWS);

/** One wasp, head to the right. */
function wasp(ox: number, oy: number) {
  const p = (x: number, y: number, hex: string) => put(img, ox + x, oy + y, hex);
  const r = (x: number, y: number, w: number, h: number, hex: string) =>
    rect(img, ox + x, oy + y, w, h, hex);

  /*
   * Two wings, thin, clear of the body.
   *
   * They were slabs four pixels deep sitting across the abdomen, which read
   * as a grey lid rather than as wings — at this size a wing is a line with a
   * lighter line inside it, and what makes it a pair is the second one being
   * a pixel lower and further back.
   */
  r(4, 5, 6, 1, WING_EDGE);
  r(5, 4, 6, 1, WING);
  r(6, 3, 7, 1, WING_EDGE);
  r(6, 4, 7, 1, WING);
  r(7, 5, 6, 1, WING_EDGE);

  /* abdomen: four bands, tapering to the sting */
  r(1, 7, 7, 5, SHELL);
  r(2, 7, 2, 5, BAND);
  r(5, 7, 2, 5, BAND);
  r(2, 7, 2, 1, BAND_LIT);
  r(5, 7, 2, 1, BAND_LIT);
  /* the taper, and the sting on the end of it */
  r(1, 8, 1, 3, SHELL);
  p(0, 9, DARK);

  /* the waist — a wasp is the one insect everybody can name by this */
  r(8, 8, 1, 3, DARK);

  /* thorax, with a collar so the head is not one dark blob with it */
  r(9, 7, 3, 5, SHELL);
  r(9, 7, 3, 1, BAND);
  r(11, 8, 1, 3, BAND_LIT);

  /* head, eye and antennae */
  r(12, 8, 3, 3, DARK);
  p(13, 9, EYE);
  p(14, 9, EYE);
  p(15, 6, DARK);
  p(14, 7, DARK);

  /* three legs, tucked the way a flying wasp holds them */
  p(9, 12, DARK);
  p(10, 13, DARK);
  p(11, 12, DARK);
  p(12, 13, DARK);

}

wasp(0, 0);

encode("src/assets/sheets/critter.png", img);
