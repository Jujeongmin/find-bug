import { useEffect } from "react";

/**
 * Space presses the button that closes whatever prompt is open.
 *
 * The key is the same one that opens things in the world, so a prompt raised
 * by space would close on the release of the very press that raised it if the
 * event were left to bubble: this listens in the capture phase and stops it
 * there, which also keeps the scene from acting on a key the player meant for
 * the dialogue in front of them.
 *
 * Only buttons marked `data-space` answer. Dismissing is safe to do blind;
 * choosing is not, so a prompt that asks a question — which defect category,
 * which item — marks nothing and space does nothing there.
 */
export function useSpaceCloses() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Enter" && e.key !== "Escape") return;
      const focused = document.activeElement;
      if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) return;

      // the last backdrop in the document is the one drawn on top
      const backdrops = document.querySelectorAll<HTMLElement>(".modal-backdrop");
      const top = backdrops[backdrops.length - 1];
      const btn = top?.querySelector<HTMLButtonElement>("button[data-space]:not([disabled])");
      if (!btn) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      btn.click();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}

/** true where a keyboard is the likely input, so the hint is worth the space */
export const HAS_KEYBOARD = matchMedia("(pointer: fine)").matches;
