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
 * The primary button answers — the blue one. That is the rule the player can
 * see: if it is blue, space presses it, in every prompt the game puts up. It
 * was a hand-placed `data-space` before, which meant the rule held wherever
 * someone had remembered to write it and quietly did not where they had not.
 *
 * `data-space` still wins if a prompt marks something explicitly, for the one
 * case that is not a blue button. A prompt with no primary and no mark — the
 * defect categories, the shop shelf — answers nothing, because choosing is not
 * safe to do blind.
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
      const pick = (root: ParentNode) =>
        root.querySelector<HTMLButtonElement>(
          "button[data-space]:not([disabled]), button.btn-primary:not([disabled])"
        );
      /*
       * With no prompt open, only a screen that has finished answers.
       *
       * The ship screen is a blue button and nothing else — no room, no
       * stations, nothing space could mean instead. Anywhere there is a world
       * layer, space belongs to whatever the player is standing next to.
       */
      const btn = top
        ? pick(top)
        : document.querySelector(".world-layer")
          ? null
          : pick(document);
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
