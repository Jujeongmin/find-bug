import type { ObjectSpec } from "../engine/types";

/**
 * Buildings, out of the city sheet.
 *
 * The pack draws a building as a run of tiles, not as a picture: an end piece
 * that carries the corner, a middle that repeats, and the other end. Taking a
 * wide rectangle of the sheet in one sprite is what put a drainpipe up the
 * middle of the first house and cut the terrace into slices — the rims are
 * drawn on the tiles, so they land wherever the rectangle happens to fall.
 *
 * `front` lays the run out properly. `solid` is the other half: what the
 * player cannot walk through, which is not the same object as what they see.
 *
 * The sheet's own grammar, read off the pixels rather than guessed at:
 *
 * - A family of four columns is `[on its own, left end, middle, right end]`.
 *   That holds for the one-tile-tall eaves (row 2), the walls (rows 5+) and
 *   the shopfronts (row 4). Taking column 0 as the left end is what boxed the
 *   first roof in on itself — column 0 is a building one tile wide.
 * - The two-tall roofs (rows 0-1) are the exception: `[left, right, middle,
 *   vertical edge]`. A run of them is left, middles, right — column 1, not
 *   column 3, closes it.
 */

/** one horizontal run of a building's face */
export function front(
  id: string,
  cols: { left: number; mid: number; right: number },
  row: number,
  rows: number,
  left: number,
  bottom: number,
  tiles: number,
  scale: number,
  z = 0
): ObjectSpec[] {
  const w = 16 * scale;
  return Array.from({ length: tiles }, (_, i) => ({
    id: `${id}${i}`,
    nameKey: `object.${id}`,
    kind: "decor" as const,
    x: left + w * i + w / 2,
    y: bottom,
    z,
    render: {
      sprite: {
        sheet: "city" as const,
        col: i === 0 ? cols.left : i === tiles - 1 ? cols.right : cols.mid,
        row,
        spanY: rows,
        scale,
      },
    },
    behaviors: [],
  }));
}

/**
 * A box the player cannot walk into, out of overlapping circles.
 *
 * Blocking is round — one radius per object — and buildings are not. A row of
 * circles whose ends land exactly on the box's edges blocks the whole face
 * without the invisible wall a single fat circle leaves sticking out of it.
 * The objects are transparent: what the player sees is the run drawn over them.
 */
export function solid(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number
): ObjectSpec[] {
  const r = h / 2;
  const n = Math.max(2, Math.ceil((w - 2 * r) / r) + 1);
  return Array.from({ length: n }, (_, i) => {
    const cx = x + r + ((w - 2 * r) * i) / (n - 1);
    return {
      id: `${id}${i}`,
      nameKey: `object.${id}`,
      kind: "decor" as const,
      x: cx - 4,
      y,
      render: { className: "edge-zone", bar: { width: 8, height: h } },
      behaviors: [{ t: "blocker" as const, radius: r }],
    };
  });
}
