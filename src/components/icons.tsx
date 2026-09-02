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
