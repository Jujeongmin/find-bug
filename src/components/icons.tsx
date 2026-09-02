/**
 * The few marks the interface needs, drawn rather than borrowed.
 *
 * These were emoji — 🔊, 🔇, ⚙ — which is three different typefaces from three
 * different vendors sitting in one panel: Apple's speaker is glossy and blue,
 * Windows' is flat and grey, and neither is the colour of the text beside it.
 * A settings panel is chrome, and chrome has to be the same weight everywhere
 * or it reads as decoration that wandered in.
 *
 * They take their colour from the text they sit in, so a disabled or accented
 * state needs no second copy of the icon.
 */

interface Props {
  size?: number;
}

const box = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
});

/** the cone alone, with room kept for the waves so the two never jump */
export function SpeakerIcon({ size = 14 }: Props) {
  return (
    <svg {...box(size)}>
      <path d="M2.5 6h2l3-2.5v9L4.5 10h-2z" fill="currentColor" stroke="none" />
      <path d="M10 6.2a2.6 2.6 0 0 1 0 3.6" />
      <path d="M12 4.4a5.2 5.2 0 0 1 0 7.2" />
    </svg>
  );
}

/** the same cone, with the waves struck out rather than removed */
export function SpeakerMutedIcon({ size = 14 }: Props) {
  return (
    <svg {...box(size)}>
      <path d="M2.5 6h2l3-2.5v9L4.5 10h-2z" fill="currentColor" stroke="none" />
      <path d="M10.5 6.5l4 3" />
      <path d="M14.5 6.5l-4 3" />
    </svg>
  );
}

/**
 * Sliders, not a cog.
 *
 * A gear at fourteen pixels is a circle with eight spokes round it, which is
 * a sunburst — the teeth that make it read as machinery need more room than
 * the corner of a phone has. Two rails and two knobs is unambiguous at any
 * size, and it is what is behind the button: a language to pick and a level
 * to set.
 */
export function SettingsIcon({ size = 14 }: Props) {
  return (
    <svg {...box(size)}>
      <path d="M2.5 5.5h11M2.5 10.5h11" />
      <circle cx="6" cy="5.5" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="10.5" r="1.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * What is left in you today, on the bar beside the pips.
 *
 * This was 👁, which on Windows is a cartoon eye with a blue iris and on
 * Android is brown — a picture from someone else's set sitting in a row of
 * numbers. The pips next to it already carry the count; the mark only has to
 * say what is being counted.
 */
export function EyeIcon({ size = 12 }: Props) {
  return (
    <svg {...box(size)} strokeWidth={1.4}>
      <path d="M1.4 8s2.4-4 6.6-4 6.6 4 6.6 4-2.4 4-6.6 4S1.4 8 1.4 8z" />
      <circle cx="8" cy="8" r="1.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * A defect, which is what the game is about and so appears on four screens:
 * the button that reports one, the briefing that promises one, the line that
 * names one, and the book that collects them.
 *
 * The emoji it replaces was 🐛 — a caterpillar on most platforms, green and
 * smiling, which is a garden animal rather than a fault in a build.
 */
export function BugIcon({ size = 14 }: Props) {
  return (
    <svg {...box(size)}>
      <ellipse cx="8" cy="9" rx="3.4" ry="4.4" fill="currentColor" stroke="none" />
      <path d="M8 4.6V2.8M6.2 3.2l-.8-1M9.8 3.2l.8-1" />
      <path d="M4.6 7H2.2M4.4 9.6H1.8M4.8 12.2l-2 1.2" />
      <path d="M11.4 7h2.4M11.6 9.6h2.6M11.2 12.2l2 1.2" />
    </svg>
  );
}

/** the magnifier: on the zoom button, and on the object being accused */
export function MagnifierIcon({ size = 14 }: Props) {
  return (
    <svg {...box(size)}>
      <circle cx="7" cy="7" r="4.4" />
      <path d="M10.3 10.3l3.3 3.3" />
    </svg>
  );
}

/** a rejected report */
export function CrossIcon({ size = 26 }: Props) {
  return (
    <svg {...box(size)} strokeWidth={2}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

/** a confirmed one */
export function CheckIcon({ size = 26 }: Props) {
  return (
    <svg {...box(size)} strokeWidth={2}>
      <path d="M2.6 8.6l3.6 3.6L13.4 4.4" />
    </svg>
  );
}

/** the build fell over: the run ended before a report could be made */
export function SkullIcon({ size = 26 }: Props) {
  return (
    <svg {...box(size)} strokeWidth={1.5}>
      <path d="M3.4 9.6A4.6 4.6 0 0 1 8 2.6a4.6 4.6 0 0 1 4.6 7v2.2a1.2 1.2 0 0 1-1.2 1.2H4.6a1.2 1.2 0 0 1-1.2-1.2z" />
      <circle cx="6.2" cy="8" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9.8" cy="8" r="1.2" fill="currentColor" stroke="none" />
      <path d="M8 10.6v2.4" />
    </svg>
  );
}

/**
 * The report button, which is the largest control in the game.
 *
 * It carried 🚨 inside the translated string, so every language shipped a
 * different vendor's rotating light — and the one mark the player presses
 * hardest was the one least under our control.
 */
export function AlertIcon({ size = 13 }: Props) {
  return (
    <svg {...box(size)}>
      <path d="M8 2.4l6 10.4H2z" />
      <path d="M8 6.6v3" />
      <circle cx="8" cy="11.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
