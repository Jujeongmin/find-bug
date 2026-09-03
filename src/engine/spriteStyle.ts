import { SHEETS, type SheetId, type SpriteSpec } from "./sheets";
import tinytownSrc from "../assets/sheets/tinytown.png";
import platformerSrc from "../assets/sheets/platformer.png";
import platcharsSrc from "../assets/sheets/platchars.png";
import roguelikeSrc from "../assets/sheets/roguelike.png";
import dungeonSrc from "../assets/sheets/dungeon.png";
import workerSrc from "../assets/sheets/worker.png";
import worker2Src from "../assets/sheets/worker2.png";
import furnitureSrc from "../assets/sheets/furniture.png";
import personASrc from "../assets/sheets/personA.png";
import personBSrc from "../assets/sheets/personB.png";
import personCSrc from "../assets/sheets/personC.png";
import citySrc from "../assets/sheets/city.png";
import officeSrc from "../assets/sheets/office.png";
import doorSrc from "../assets/props/door.png";
import crateSrc from "../assets/props/crate.png";
import barrelSrc from "../assets/props/barrel.png";
import rugSrc from "../assets/props/rug.png";
import { PROPS, type PropId, type PropRef } from "./props";

/**
 * Bundled sheet images. Importing them (rather than pointing at /public) lets
 * Vite rewrite the URLs for whatever base path the game is deployed under —
 * the Verse8 editor preview serves from a sub-path.
 */
const SHEET_SRC: Record<SheetId, string> = {
  tinytown: tinytownSrc,
  platformer: platformerSrc,
  platchars: platcharsSrc,
  roguelike: roguelikeSrc,
  dungeon: dungeonSrc,
  worker: workerSrc,
  worker2: worker2Src,
  furniture: furnitureSrc,
  personA: personASrc,
  personB: personBSrc,
  personC: personCSrc,
  city: citySrc,
  office: officeSrc,
};

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
    backgroundImage: `url(${SHEET_SRC[s.sheet]})`,
    backgroundPosition: `${-s.col * step * scale}px ${-s.row * step * scale}px`,
    backgroundSize: `${sheet.cols * step * scale}px ${sheet.rows * step * scale}px`,
    backgroundRepeat: "no-repeat",
    imageRendering: "pixelated",
  };
}

const PROP_SRC: Record<PropId, string> = {
  door: doorSrc,
  crate: crateSrc,
  barrel: barrelSrc,
  rug: rugSrc,
};

/**
 * Every image the game draws, for the loading screen to fetch before it opens.
 *
 * Taken from the same two tables the renderer reads rather than written out
 * again, so a sheet added to the game is a sheet the loading screen waits for.
 */
export const ART: string[] = [
  ...Object.values(SHEET_SRC),
  ...Object.values(PROP_SRC),
];

/** the player's own sheet, which the loading screen walks along its bar */
export const WALK_SHEET = workerSrc;

/** CSS for a standalone prop image, drawn at its authored aspect ratio */
export function propStyle(p: PropRef): React.CSSProperties {
  const spec = PROPS[p.id];
  const scale = p.scale ?? 1;
  return {
    width: spec.w * scale,
    height: spec.h * scale,
    backgroundImage: `url(${PROP_SRC[p.id]})`,
    backgroundSize: "100% 100%",
    backgroundRepeat: "no-repeat",
    imageRendering: "pixelated",
  };
}
