/**
 * Trigger conditions for a defect.
 *
 * A defect does not fire every time — it fires when every one of its
 * conditions holds. That is what makes a user report say "가끔" and what turns
 * finding it into an experiment rather than a search: the player changes one
 * thing at a time until the fault reproduces on demand.
 *
 * The vocabulary is deliberately small and fully shown to the player. The
 * puzzle is which conditions matter, not guessing what a condition could be.
 */
export type Condition =
  | { t: "counterAtLeast"; counter: string; n: number }
  | { t: "counterBelow"; counter: string; n: number }
  /** the same object was tapped this many times in a row */
  | { t: "repeatSame"; n: number }
  /** a patrolling object is within `radius` horizontally of the tapped one */
  | { t: "near"; objectId: string; radius: number }
  /** tapped within `s` seconds of the previous action */
  | { t: "withinSeconds"; s: number };

export interface Context {
  counters: Record<string, number>;
  objects: Record<string, { x: number; y: number }>;
  now: number;
  /** the object being tapped */
  objectId: string;
  /** what was tapped before this, and when */
  prevObjectId: string | null;
  prevAt: number | null;
  /** how many times in a row the same object has been tapped, including now */
  sameStreak: number;
}

export function holds(c: Condition, ctx: Context): boolean {
  switch (c.t) {
    case "counterAtLeast":
      return (ctx.counters[c.counter] ?? 0) >= c.n;
    case "counterBelow":
      return (ctx.counters[c.counter] ?? 0) < c.n;
    case "repeatSame":
      return ctx.sameStreak >= c.n;
    case "near": {
      const a = ctx.objects[ctx.objectId];
      const b = ctx.objects[c.objectId];
      if (!a || !b) return false;
      // horizontal only: the shelf and the floor are far apart vertically, and
      // "walked past it" is what the player can actually see happen
      return Math.abs(a.x - b.x) <= c.radius;
    }
    case "withinSeconds":
      return ctx.prevAt !== null && ctx.now - ctx.prevAt <= c.s;
  }
}

/** stable id, used to compare the player's answer with the real trigger */
export function idOf(c: Condition): string {
  switch (c.t) {
    case "counterAtLeast":
      return `counterAtLeast:${c.counter}:${c.n}`;
    case "counterBelow":
      return `counterBelow:${c.counter}:${c.n}`;
    case "repeatSame":
      return `repeatSame:${c.n}`;
    case "near":
      return `near:${c.objectId}:${c.radius}`;
    case "withinSeconds":
      return `withinSeconds:${c.s}`;
  }
}

export function labelOf(c: Condition): { key: string; params: Record<string, string> } {
  switch (c.t) {
    case "counterAtLeast":
      return { key: "cond.counterAtLeast", params: { counter: `counter.${c.counter}`, n: String(c.n) } };
    case "counterBelow":
      return { key: "cond.counterBelow", params: { counter: `counter.${c.counter}`, n: String(c.n) } };
    case "repeatSame":
      return { key: "cond.repeatSame", params: { n: String(c.n) } };
    case "near":
      return { key: "cond.near", params: { obj: `object.${c.objectId}` } };
    case "withinSeconds":
      return { key: "cond.withinSeconds", params: { s: String(c.s) } };
  }
}
