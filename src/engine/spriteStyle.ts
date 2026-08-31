import { SHEETS, type SheetId, type SpriteSpec } from "./sheets";
import tinytownSrc from "../assets/sheets/tinytown.png";
import platformerSrc from "../assets/sheets/platformer.png";
import platcharsSrc from "../assets/sheets/platchars.png";
import roguelikeSrc from "../assets/sheets/roguelike.png";

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
