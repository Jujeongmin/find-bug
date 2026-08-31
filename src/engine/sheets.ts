/**
 * Sprite sheets shipped in /public/assets. All Kenney packs, all CC0 —
 * see docs/ASSETS.md for the inventory and licence notes.
 */
export interface SheetSpec {
  src: string;
  /** pixel size of one tile */
  tile: number;
  /** gap between tiles in the sheet */
  margin: number;
  cols: number;
  rows: number;
}

export const SHEETS = {
  tinytown: { src: "/assets/tinytown.png", tile: 16, margin: 0, cols: 12, rows: 11 },
  platformer: { src: "/assets/platformer.png", tile: 18, margin: 0, cols: 20, rows: 9 },
  // characters are 24px, not 18px like the rest of the platformer pack
  platchars: { src: "/assets/platchars.png", tile: 24, margin: 0, cols: 9, rows: 3 },
  roguelike: { src: "/assets/roguelike.png", tile: 16, margin: 1, cols: 57, rows: 31 },
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

/** CSS needed to show one sprite, scaled and pixel-crisp */
export function spriteStyle(s: SpriteSpec): React.CSSProperties {
  const sheet = SHEETS[s.sheet];
  const step = sheet.tile + sheet.margin;
  const scale = s.scale ?? 3;
  const spanX = s.spanX ?? 1;
  const spanY = s.spanY ?? 1;
  return {
    width: sheet.tile * spanX * scale,
    height: sheet.tile * spanY * scale,
    backgroundImage: `url(${sheet.src})`,
    backgroundPosition: `${-s.col * step * scale}px ${-s.row * step * scale}px`,
    backgroundSize: `${sheet.cols * step * scale}px ${sheet.rows * step * scale}px`,
    backgroundRepeat: "no-repeat",
    imageRendering: "pixelated",
  };
}
