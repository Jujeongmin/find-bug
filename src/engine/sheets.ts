/**
 * Sprite sheet geometry. Deliberately free of image imports so the Node-based
 * verification scripts can read scene data without a bundler — the image URLs
 * live in ./spriteStyle.ts, which only the renderer touches.
 *
 * All sheets are Kenney packs, CC0. See docs/ASSETS.md.
 */
export interface SheetSpec {
  /** pixel size of one tile */
  tile: number;
  /** gap between tiles in the sheet */
  margin: number;
  cols: number;
  rows: number;
}

export const SHEETS = {
  tinytown: { tile: 16, margin: 0, cols: 12, rows: 11 },
  platformer: { tile: 18, margin: 0, cols: 20, rows: 9 },
  // characters are 24px, not 18px like the rest of the platformer pack
  platchars: { tile: 24, margin: 0, cols: 9, rows: 3 },
  roguelike: { tile: 16, margin: 1, cols: 57, rows: 31 },
  // same 12x11 grid and same outline weight as tinytown, so the two mix
  // without the seam that cost stage 1 its trees
  dungeon: { tile: 16, margin: 0, cols: 12, rows: 11 },
  // Puny Characters (CC0): 32px frames, rows are the eight facings in
  // counter-clockwise order from down, columns are idle then the walk cycle
  worker: { tile: 32, margin: 0, cols: 24, rows: 8 },
  worker2: { tile: 32, margin: 0, cols: 24, rows: 8 },
  // Drawn here rather than downloaded: no pack in the repo has an office
  // desk or a monitor. scripts/officeart.ts builds it.
  office: { tile: 16, margin: 0, cols: 4, rows: 4 },
  // The same 32px frames as worker, palette-swapped by scripts/recolor.ts:
  // three people who are not each other and not the player.
  personA: { tile: 32, margin: 0, cols: 24, rows: 8 },
  personB: { tile: 32, margin: 0, cols: 24, rows: 8 },
  personC: { tile: 32, margin: 0, cols: 24, rows: 8 },
  // Roguelike Modern City: the packed tilemap, so no margin. 37x28 of 16px
  // tiles — brick and plaster walls, roofs, shop fronts, doors, windows,
  // pavement and street furniture, drawn with the same outline weight as Tiny
  // Town and Tiny Dungeon.
  city: { tile: 16, margin: 0, cols: 37, rows: 28 },
  // Drawn here for the same reason the office desk is: no pack in the
  // repository has an insect, and the herb field needs the wasp its own goal
  // line promises. scripts/critterart.ts builds it.
  critter: { tile: 16, margin: 0, cols: 1, rows: 1 },
  // Messy Furniture (32px grid). Pieces span more than one cell — a bed is one
  // column by two rows, a sofa two by two — so they are drawn with spanX/spanY.
  furniture: { tile: 32, margin: 0, cols: 13, rows: 14 },
} as const satisfies Record<string, SheetSpec>;

export type SheetId = keyof typeof SHEETS;

/**
 * How many empty rows a character sheet leaves under the drawn feet.
 *
 * An entity is placed by the bottom edge of its frame, so a sheet that draws a
 * 14px person in the middle of a 32px canvas draws the feet eight rows above
 * the point the game uses for collision and for y-sorting. On the walk that is
 * twelve display pixels, and it is why the house read as something the player
 * could stand on top of: they stop correctly at the bottom of the wall and are
 * drawn a brick course inside it.
 *
 * Measured, not guessed — `npx tsx scripts/footpad.ts` decodes each sheet, takes
 * the lowest opaque row across every frame the animation shows, and fails if
 * these numbers have drifted from the art. The value is the ground line rather
 * than any one frame's, so a raised knee does not make the character bob.
 *
 * Only sheets with a number here have one; anything absent is drawn on its own
 * feet already, which is what the platformer characters do.
 */
export const FOOT_PAD: Partial<Record<SheetId, number>> = {
  worker: 8,
  worker2: 8,
  personA: 8,
  personB: 8,
  personC: 8,
};

/** the same gap in display pixels, which is what the renderer wants */
export function footPadPx(sheet: SheetId, scale: number): number {
  return (FOOT_PAD[sheet] ?? 0) * scale;
}

export interface SpriteSpec {
  sheet: SheetId;
  /** tile column and row in the sheet */
  col: number;
  row: number;
  /** how many tiles the sprite spans */
  spanX?: number;
  spanY?: number;
  /** display scale; 3 turns a 16px tile into 48px */
  scale?: number;
}
