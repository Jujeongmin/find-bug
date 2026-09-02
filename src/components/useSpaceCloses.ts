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
 * case that is not a blue button, and `data-no-space` opts a blue button out.
 * Filing a report is the one press in the game that cannot be taken back, and
 * space is a reflex — it is the key the player has been hammering to walk, to
 * read a line, to close a prompt. That one has to be aimed.
 */
const LEARNED_KEY = "fb_learned_space";

/**
 * Whether the player still needs telling that space is a key.
 *
 * The hint was on every blue button, which teaches the rule four times a
 * minute for the rest of the run. It belongs on the first thing the player
 * walks up to — the front door on the first morning — and nowhere after they
 * have pressed the key once, because at that point they know.
 */
function learned(): boolean {
  try {
    return localStorage.getItem(LEARNED_KEY) === "1";
  } catch {
    return false;
  }
}

function markLearned(): void {
  try {
    localStorage.setItem(LEARNED_KEY, "1");
  } catch {
    /* a browser that will not store just keeps showing the hint */
  }
  document.documentElement.classList.remove("learning-space");
}

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
          "button[data-space]:not([disabled]), button.btn-primary:not([disabled]):not([data-no-space])"
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
    document.documentElement.classList.toggle("learning-space", !learned());
    // the world key counts too: activating a station is the lesson
    /*
     * The lesson is the door, not the dialogue.
     *
     * Marking it learned on any space press meant the first morning's prompt
     * taught it: the player closes that with space and the badge is gone
     * before they ever walk up to the thing it was for. Closing a box teaches
     * that space closes boxes. Opening the front door with it is the other
     * lesson, and the badge belongs to that one — so it only counts while a
     * station is actually offering itself.
     */
    const onAnySpace = (e: KeyboardEvent) => {
      if (e.key !== " ") return;
      if (!document.querySelector(".eng-station-btn")) return;
      markLearned();
    };
    window.addEventListener("keydown", onAnySpace);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onAnySpace);
      window.removeEventListener("keydown", onKey, true);
    };
  }, []);
}

/** true where a keyboard is the likely input, so the hint is worth the space */
export const HAS_KEYBOARD = matchMedia("(pointer: fine)").matches;
