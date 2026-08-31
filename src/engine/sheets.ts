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
} as const satisfies Record<string, SheetSpec>;

export type SheetId = keyof typeof SHEETS;

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
