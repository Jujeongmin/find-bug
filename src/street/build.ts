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

/**
 * The studio's entrance: the sheet's glass double door, two leaves of three
 * tiles each. Only the leaf named `id` carries anything — the other is
 * dressing — so a caller can hang a station on the pair without the player
 * being offered the same door twice.
 */
export function glassDoor(
  id: string,
  x: number,
  bottom: number,
  scale: number,
  behaviors: ObjectSpec["behaviors"],
  z = 2
): ObjectSpec[] {
  const w = 16 * scale;
  return [19, 20].map((col, i) => ({
    id: i === 0 ? id : `${id}Leaf`,
    nameKey: `object.${id}`,
    kind: "sprite" as const,
    x: x + (i === 0 ? -w / 2 : w / 2),
    y: bottom,
    z,
    render: {
      sprite: { sheet: "city" as const, col, row: 10, spanY: 3, scale },
    },
    behaviors: i === 0 ? behaviors : [],
  }));
}

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
 * A box the player cannot walk into.
 *
 * This was a row of overlapping circles, on the reasoning that blocking is
 * round and a building is not, so a run of them with their ends on the box's
 * edges would cover the face. It does not: a circle cannot reach into a
 * corner, and two circles side by side leave a scallop between them. Measured
 * on the house — a hundred and seventy-eight across by eighty-eight down, four
 * circles of radius forty-four — the top corners were open for thirty pixels
 * each and there were notches between every pair. That is a player standing
 * inside their own front wall, which is what it was reported as.
 *
 * A blocker takes a box, which the vending machine on the street has used all
 * along, and a box is exactly a box. One object, one blocker, no corners left.
 *
 * The object is transparent: what the player sees is the run drawn over it.
 */
export function solid(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number
): ObjectSpec[] {
  return [
    {
      id,
      nameKey: `object.${id}`,
      kind: "decor" as const,
      x,
      y,
      render: { className: "edge-zone", bar: { width: w, height: h } },
      /*
       * The radius is not what does the blocking once a box is given — it is
       * still what the movement code pushes away from when somebody is already
       * inside, so it is the box's own half-diagonal rather than a token.
       */
      behaviors: [
        {
          t: "blocker" as const,
          radius: Math.hypot(w, h) / 2,
          box: { w, h },
        },
      ],
    },
  ];
}
