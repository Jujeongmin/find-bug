/**
 * The magnifier has to survive being moved.
 *
 * It is a hold-to-zoom button, and the gesture it exists for is press and
 * drag: hold it, move, look at what you are moving over. Two things in the
 * first version made that the one gesture it could not do. The button took no
 * pointer capture, so on a mouse the first pixel of movement left its 46px
 * circle; and it dropped the zoom on pointerleave, so that pixel ended the
 * hold. Reported as the magnifier simply not working.
 *
 * These are source assertions rather than a rendered test — there is no DOM
 * harness in this repository — but they hold the two lines that mattered. A
 * pointerleave handler put back on that button, or a camera that stops reading
 * the drag, fails here.
 *
 * Run: npx tsx scripts/checkzoom.ts
 */
import { readFileSync } from "node:fs";

const SRC = "src/engine/EngineStage.tsx";
const src = readFileSync(SRC, "utf8");

let bad = 0;
const ok = (claim: string, pass: boolean, detail = "") => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${claim}${detail ? ` — ${detail}` : ""}`);
  if (!pass) bad++;
};

/** the whole `<button className="eng-zoom-btn" …>` element, attributes only */
const button = (() => {
  const at = src.indexOf('className={`eng-zoom-btn');
  if (at < 0) return "";
  const end = src.indexOf(">", src.indexOf("<MagnifierIcon", at));
  return end < 0 ? "" : src.slice(at, end);
})();

console.log("\nthe magnifier is held, and being held it is dragged");
ok("the zoom button is still in the stage", button.length > 0, SRC);
ok(
  "it captures the pointer, so leaving the button does not leave the hold",
  /setPointerCapture\(e\.pointerId\)/.test(button)
);
ok(
  "and nothing switches it off merely because the pointer moved away",
  // the handler, not the word: the comment above the button names it
  !/onPointerLeave\s*=/.test(button),
  "onPointerLeave is what made press-and-move the one gesture it could not do"
);
ok("the hold still ends on release", /onPointerUp=/.test(button));
ok("and on a cancelled pointer", /onPointerCancel=/.test(button));
ok("the drag is followed", /onPointerMove=/.test(button));

console.log("\nand what the drag moves is the camera");
ok(
  "the view is offset by the drag rather than pinned to the player",
  /const fx = ps\.x \+ \(zoomed && zoomPan \? zoomPan\.x : 0\)/.test(src) &&
    /const fy = ps\.y \+ \(zoomed && zoomPan \? zoomPan\.y : 0\)/.test(src)
);
ok(
  "the pan is divided by the zoom, so the world moves at the speed the hand does",
  /FIELD_W\) \* ZOOM;/.test(src)
);
ok(
  "a press on its own pans nothing, so the view does not jump to the corner the button sits in",
  /setZoomPan\(null\);\s*\n\s*setZoomed\(true\);/.test(src)
);

console.log(bad ? `\n${bad} FAIL` : "\nthe magnifier can be dragged");
process.exitCode = bad ? 1 : 0;
