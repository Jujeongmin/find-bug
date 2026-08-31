/**
 * Standalone prop images.
 *
 * Sheets cover art laid out on a fixed grid. These are the other kind: single
 * images at whatever size the artist drew them (a desk is 38x29, a rug 72x50),
 * which no grid can describe. Kept free of image imports for the same reason
 * `sheets.ts` is — the Node verification scripts read scene data and cannot
 * load PNGs.
 *
 * From Fantasy Interior Tiles by Cardinal Zebra, CC0. See docs/ASSETS.md.
 */
export interface PropSpec {
  w: number;
  h: number;
}

export const PROPS = {
  desk: { w: 38, h: 29 },
  bookshelf: { w: 33, h: 33 },
  chair: { w: 13, h: 23 },
  chairSide: { w: 14, h: 21 },
  door: { w: 24, h: 30 },
  doorOpen: { w: 24, h: 30 },
  crate: { w: 16, h: 23 },
  barrel: { w: 17, h: 22 },
  rug: { w: 72, h: 50 },
  windowPane: { w: 32, h: 32 },
} as const satisfies Record<string, PropSpec>;

export type PropId = keyof typeof PROPS;

/** a prop drawn at its own aspect ratio */
export interface PropRef {
  id: PropId;
  /** 1 draws it at its authored pixel size */
  scale?: number;
}
