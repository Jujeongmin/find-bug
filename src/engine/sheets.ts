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
  office: { tile: 16, margin: 0, cols: 4, rows: 2 },
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
  // Roguelike Indoors, which does keep the pack's 1px margin. Desks, screens,
  // chairs and the rest of an office seen from the front.
  indoor: { tile: 16, margin: 1, cols: 27, rows: 18 },
  // 64 food sprites on an 8x8 grid: what a stall sells.
  food: { tile: 16, margin: 0, cols: 8, rows: 8 },
  // Messy Furniture (32px grid). Pieces span more than one cell — a bed is one
  // column by two rows, a sofa two by two — so they are drawn with spanX/spanY.
  furniture: { tile: 32, margin: 0, cols: 13, rows: 14 },
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
